// "Esqueci a senha" por e-mail: token aleatório de uso único e validade de 1 hora, guardado só como hash,
// resposta igual exista ou não a conta, sessões antigas encerradas. O relógio do servidor é fixado
// para a validade. MySQL real e descartável (tests/support/bancoDeTeste.ts); sem HRFLOW_TEST_DB_HOST o
// teste é pulado.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type http from 'node:http';
import type { RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcrypt';
import * as banco from './support/bancoDeTeste.ts';
import { criarColaborador, criarEmpresa } from './support/empresas.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import { subirServidor, pararServidor, LIMITES_AUTH_FOLGADOS } from './support/servidor.ts';
import db from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import { configurarEmail } from '../shared/email/email.ts';
import type { Email } from '../shared/email/email.ts';
import { relogio } from '../shared/utils/fuso.ts';

const SENHA_ANTIGA = 'senha-antiga-ficticia';
const SENHA_NOVA = 'senha-nova-ficticia';
const MENSAGEM_GENERICA = 'Se o e-mail estiver cadastrado, enviamos as instruções para redefinir a senha.';

describe('esqueci a senha', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let baseUrl: string;
    const enviados: Email[] = [];
    let hashAntigo: string;
    let empresaId: number;

    const chamar = async (metodo: string, caminho: string, corpo?: unknown, token?: string) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        const texto = await resposta.text();
        return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
    };
    const pedir = (email: string) => chamar('POST', '/api/auth/esqueci-senha', { email });
    const redefinir = (token: string, senha = SENHA_NOVA) => chamar('POST', '/api/auth/redefinir-senha', { token, senha });
    const entrar = (email: string, senha: string) => chamar('POST', '/api/auth/login', { email, senha });
    const tokenDoEmail = (email: Email): string => /#token=([A-Za-z0-9_-]+)/.exec(email.texto)![1];
    const esperarEmail = async (quantos = 1) => {
        for (let i = 0; i < 100 && enviados.length < quantos; i += 1) await new Promise((r) => setTimeout(r, 20));
    };

    // Uma conta nova com a senha antiga, para cada teste não depender do estado do anterior.
    const novaConta = async (perfil = 'RH', opcoes: { funcionarioId?: number | null } = {}) => {
        const { usuario, token } = await criarUsuario(db, { empresaId, perfil, funcionarioId: opcoes.funcionarioId ?? null, senhaHash: hashAntigo });
        return { id: usuario.id as number, email: usuario.email as string, nome: usuario.nome as string, token };
    };

    before(async () => {
        await banco.preparar();
        // Limites folgados: o teste do teto cria o próprio app.
        ({ server: servidor, baseUrl } = await subirServidor(criarApp({ limitesAuth: { ...LIMITES_AUTH_FOLGADOS, esqueciSenhaPorIp: { windowMs: 60_000, limit: 1000 }, esqueciSenhaPorIdentidade: { windowMs: 60_000, limit: 1000 } } })));
        hashAntigo = await bcrypt.hash(SENHA_ANTIGA, 4);
        empresaId = (await criarEmpresa(db)).empresaId;
    });

    afterEach(() => {
        relogio.agora = () => Date.now();
        enviados.length = 0;
        configurarEmail(null);
    });

    after(async () => {
        await pararServidor(servidor);
        await db.end();
        await banco.encerrar();
    });

    const configurar = () => configurarEmail({
        transporte: { enviar: async (email) => { enviados.push(email); } },
        remetente: 'HRFlow <nao-responder@exemplo.invalid>',
        urlDoApp: 'https://hrflow.exemplo.invalid',
    });

    it('envia um e-mail em pt-BR com o link de uso único, e o banco guarda só o hash do token', async () => {
        configurar();
        const conta = await novaConta();
        const resposta = await pedir(conta.email);
        assert.deepEqual(resposta, { status: 200, corpo: { mensagem: MENSAGEM_GENERICA } });

        await esperarEmail();
        assert.equal(enviados.length, 1);
        const [email] = enviados;
        assert.equal(email.para.email, conta.email);
        assert.equal(email.assunto, 'Redefinição de senha do HRFlow');
        assert.match(email.texto, /O link vale por 60 minutos e só pode ser usado uma vez\./);
        assert.match(email.texto, /https:\/\/hrflow\.exemplo\.invalid\/redefinir-senha#token=[A-Za-z0-9_-]{43}/);
        assert.match(email.html, /<html lang="pt-BR">/);
        assert.match(email.html, /Redefinir a senha/);

        const token = tokenDoEmail(email);
        const [[linha]] = await db.query<RowDataPacket[]>('SELECT token_hash, usado_em FROM redefinicoes_de_senha WHERE usuario_id = ?', [conta.id]);
        assert.equal(linha.token_hash, crypto.createHash('sha256').update(token).digest('hex'));
        assert.notEqual(linha.token_hash, token);
        assert.equal(linha.usado_em, null);
    });

    it('a resposta é a mesma para um e-mail sem conta, e nada é enviado nem gravado', async () => {
        configurar();
        const [[{ antes }]] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS antes FROM redefinicoes_de_senha');
        const resposta = await pedir('ninguem@exemplo.invalid');
        assert.deepEqual(resposta, { status: 200, corpo: { mensagem: MENSAGEM_GENERICA } });
        await new Promise((r) => setTimeout(r, 100));
        assert.equal(enviados.length, 0);
        const [[{ depois }]] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS depois FROM redefinicoes_de_senha');
        assert.equal(depois, antes);
    });

    it('quem foi desligado não recebe o e-mail, mas a resposta continua a mesma', async () => {
        configurar();
        const colaborador = await criarColaborador(db, empresaId, { nome: 'Desligado Ficticio', salario: 3000, status: 'Inativo', desligamento: '2026-01-31' });
        const resposta = await pedir(colaborador.usuario.email);
        assert.deepEqual(resposta, { status: 200, corpo: { mensagem: MENSAGEM_GENERICA } });
        await new Promise((r) => setTimeout(r, 100));
        assert.equal(enviados.length, 0);
    });

    it('redefine a senha com o token: a nova entra, a antiga não, e o token não vale de novo', async () => {
        configurar();
        const conta = await novaConta();
        await pedir(conta.email);
        await esperarEmail();
        const token = tokenDoEmail(enviados[0]);

        assert.deepEqual(await redefinir(token), { status: 200, corpo: { mensagem: 'Senha redefinida. Entre com a nova senha.' } });
        assert.equal((await entrar(conta.email, SENHA_NOVA)).status, 200);
        assert.equal((await entrar(conta.email, SENHA_ANTIGA)).status, 401);

        const outra = await redefinir(token, 'outra-senha-ficticia');
        assert.equal(outra.status, 400);
        assert.match(outra.corpo.erro, /inválido ou expirou/);
        assert.equal((await entrar(conta.email, 'outra-senha-ficticia')).status, 401);
        const [[linha]] = await db.query<RowDataPacket[]>('SELECT usado_em FROM redefinicoes_de_senha WHERE usuario_id = ?', [conta.id]);
        assert.notEqual(linha.usado_em, null);
    });

    it('o token vale por 1 hora: no último segundo ainda serve, depois não', async () => {
        configurar();
        const inicio = Date.parse('2026-06-01T12:00:00Z');
        const expirado = await novaConta();
        const valido = await novaConta();

        relogio.agora = () => inicio;
        await pedir(expirado.email);
        await pedir(valido.email);
        await esperarEmail(2);
        const [tokenExpirado, tokenValido] = enviados.map(tokenDoEmail);

        relogio.agora = () => inicio + 3600 * 1000 + 1000;
        assert.equal((await redefinir(tokenExpirado)).status, 400);
        assert.equal((await entrar(expirado.email, SENHA_ANTIGA)).status, 200, 'a senha antiga continua valendo');

        relogio.agora = () => inicio + 3599 * 1000;
        assert.equal((await redefinir(tokenValido)).status, 200);
    });

    it('um pedido novo invalida o link do anterior', async () => {
        configurar();
        const conta = await novaConta();
        await pedir(conta.email);
        await pedir(conta.email);
        await esperarEmail(2);
        const [primeiro, segundo] = enviados.map(tokenDoEmail);
        assert.equal((await redefinir(primeiro)).status, 400);
        assert.equal((await redefinir(segundo)).status, 200);
    });

    it('duas requisições simultâneas com o mesmo token: só uma consome', async () => {
        configurar();
        const conta = await novaConta();
        await pedir(conta.email);
        await esperarEmail();
        const token = tokenDoEmail(enviados[0]);
        const resultados = await Promise.all([redefinir(token, 'senha-da-corrida-1'), redefinir(token, 'senha-da-corrida-2')]);
        assert.deepEqual(resultados.map((r) => r.status).sort(), [200, 400]);
    });

    it('redefinir encerra as sessões abertas e tira a conta da senha provisória', async () => {
        configurar();
        const conta = await novaConta();
        await db.query('UPDATE usuarios SET senha_provisoria = TRUE WHERE id = ?', [conta.id]);
        await pedir(conta.email);
        await esperarEmail();
        await redefinir(tokenDoEmail(enviados[0]));

        assert.equal((await chamar('GET', '/api/auth/sessao', undefined, conta.token)).status, 401, 'a sessão antiga caiu');
        const [[usuario]] = await db.query<RowDataPacket[]>('SELECT senha_provisoria FROM usuarios WHERE id = ?', [conta.id]);
        assert.equal(usuario.senha_provisoria, 0);
        const sessao = await entrar(conta.email, SENHA_NOVA);
        assert.equal(sessao.status, 200);
        assert.equal(sessao.corpo.senhaProvisoria, false);
    });

    it('recusa token malformado, desconhecido e senha fraca; a senha fraca não consome o token', async () => {
        configurar();
        const conta = await novaConta();
        await pedir(conta.email);
        await esperarEmail();
        const token = tokenDoEmail(enviados[0]);

        for (const ruim of ['', 'curto', 'x'.repeat(43), `${token}extra`, "' OR 1=1 --", 42]) {
            const resposta = await chamar('POST', '/api/auth/redefinir-senha', { token: ruim, senha: SENHA_NOVA });
            assert.equal(resposta.status, 400, String(ruim));
            assert.match(resposta.corpo.erro, /inválido ou expirou/);
        }
        const fraca = await redefinir(token, 'curta');
        assert.equal(fraca.status, 400);
        assert.match(fraca.corpo.erro, /no mínimo 8 caracteres/);
        assert.equal((await redefinir(token)).status, 200, 'o token seguiu valendo');
    });

    it('recusa corpo sem e-mail ou com e-mail malformado', async () => {
        configurar();
        for (const corpo of [{}, { email: '' }, { email: 'sem-arroba' }, { email: 42 }, 'texto']) {
            assert.equal((await chamar('POST', '/api/auth/esqueci-senha', corpo)).status, 400, JSON.stringify(corpo));
        }
    });

    it('sem e-mail configurado a rota diz que não está habilitada, em vez de prometer', async () => {
        const conta = await novaConta();
        const resposta = await pedir(conta.email);
        assert.equal(resposta.status, 501);
        assert.match(resposta.corpo.erro, /Procure o RH/);
    });

    it('o pedido é limitado por e-mail: o quarto no mesmo e-mail recebe 429 e nenhum e-mail a mais', async () => {
        configurar();
        const { server, baseUrl: url } = await subirServidor(criarApp());
        try {
            const conta = await novaConta();
            const pedirNoApp = (email: string) => fetch(`${url}/api/auth/esqueci-senha`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
            });
            const status: number[] = [];
            for (let i = 0; i < 4; i += 1) status.push((await pedirNoApp(conta.email)).status);
            assert.deepEqual(status, [200, 200, 200, 429]);
            await esperarEmail(3);
            await new Promise((r) => setTimeout(r, 100));
            assert.equal(enviados.length, 3);
        } finally {
            await pararServidor(server);
        }
    });
});
