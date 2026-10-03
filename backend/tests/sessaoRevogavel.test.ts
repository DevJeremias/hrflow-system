// Regressão do SEC-06: a sessão cai na troca de senha, na inativação e na exclusão do funcionário;
// funcionário inativo não faz login; o token dura 8 horas. Cada cenário reproduz um achado da
// revisão técnica de 11/09/2026, de ponta a ponta contra o MySQL migrado (tests/support/bancoDeTeste.js).
// Sem HRFLOW_TEST_DB_HOST os testes são marcados como ignorados, nunca como aprovados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2/promise';
import banco from './support/bancoDeTeste.js';
import { cabecalhosDaSessao, tokenDaResposta } from './support/sessao.js';
import pool from '../shared/db/pool.js';
import authMiddleware from '../shared/middlewares/authMiddleware.js';
import { funcionariosRoutes } from '../modules/funcionarios/index.ts';
import { perfilRoutes } from '../modules/perfil/index.ts';
import { criarAuthRouter } from '../modules/auth/index.ts';
import { pararServidor, subirServidor } from './support/servidor.ts';

// O que os testes leem das claims do token que o login emitiu.
interface Claims extends jwt.JwtPayload {
    id: number;
    perfil: string;
    empresa_id: number;
    funcionario_id: number | null;
    sv: number;
}

const claimsDe = (token: string | undefined) => jwt.decode(token as string) as Claims;

describe('sessão revogável (SEC-06)', { skip: banco.skip }, () => {
    let server: http.Server;
    let baseUrl: string;
    let empresa: number;
    let tokenAdmin: string | undefined;
    let sequencia = 0;

    const chamar = async (metodo: string, caminho: string, token: string | undefined | null, corpo?: object) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
            body: corpo ? JSON.stringify(corpo) : undefined,
        });
        return { status: resposta.status, corpo: await resposta.json(), token: tokenDaResposta(resposta) };
    };

    const login = (email: string, senha: string) => chamar('POST', '/api/auth/login', null, { email, senha });

    // Colaborador criado pela API, como o RH faria, com a senha informada.
    const novoColaborador = async (senha = 'senha-ficticia-1') => {
        sequencia += 1;
        const email = `colaborador${sequencia}@sessao.exemplo.invalid`;
        const criado = await chamar('POST', '/api/funcionarios', tokenAdmin, {
            nome: `Colaborador Ficticio ${sequencia}`, email, senha, data_admissao: '2024-01-02',
        });
        assert.equal(criado.status, 201);
        const [[funcionario]] = await pool.query<RowDataPacket[]>('SELECT id FROM funcionarios WHERE email = ?', [email]);
        const entrada = await login(email, senha);
        assert.equal(entrada.status, 200);
        return { email, senha, funcionarioId: funcionario.id, token: entrada.token };
    };

    const atualizarStatus = (colaborador: { funcionarioId: number; email: string }, status: string) => chamar('PUT', `/api/funcionarios/${colaborador.funcionarioId}`, tokenAdmin, {
        nome: `Colaborador Ficticio ${colaborador.funcionarioId}`, email: colaborador.email, status,
    });

    const consultar = (token: string | undefined) => chamar('GET', '/api/perfil/meus-dados', token);

    before(async () => {
        await banco.preparar();

        const app = express();
        app.use(express.json());
        app.use('/api/auth', criarAuthRouter({
            loginPorIp: { windowMs: 60_000, limit: 1000 },
            loginPorIdentidade: { windowMs: 60_000, limit: 1000 },
            registroPorIp: { windowMs: 60_000, limit: 1000 },
            registroPorIdentidade: { windowMs: 60_000, limit: 1000 },
        }));
        app.use('/api/funcionarios', authMiddleware, funcionariosRoutes);
        app.use('/api/perfil', authMiddleware, perfilRoutes);
        ({ server, baseUrl } = await subirServidor(app));

        const registro = await chamar('POST', '/api/auth/registrar', null, {
            nomeEmpresa: 'Empresa Sessao Ficticia', nomeAdmin: 'Admin Sessao Ficticio',
            email: 'admin@sessao.exemplo.invalid', senha: 'senha-admin-ficticia',
        });
        assert.equal(registro.status, 201);
        tokenAdmin = (await login('admin@sessao.exemplo.invalid', 'senha-admin-ficticia')).token;
        [[{ id: empresa }]] = await pool.query<RowDataPacket[]>('SELECT id FROM empresas');
    });

    after(async () => {
        await pararServidor(server);
        await pool.end();
        await banco.encerrar();
    });

    it('o token novo dura 8 horas e carrega a versão da sessão', async () => {
        const colaborador = await novoColaborador();
        const { exp, iat, sv } = claimsDe(colaborador.token);
        assert.ok(exp !== undefined && iat !== undefined);
        assert.equal(exp - iat, 8 * 60 * 60);
        assert.equal(sv, 0);
        assert.equal((await consultar(colaborador.token)).status, 200);
    });

    it('funcionário inativo não faz login, com a senha correta', async () => {
        const colaborador = await novoColaborador();
        assert.equal((await atualizarStatus(colaborador, 'Inativo')).status, 200);

        const tentativa = await login(colaborador.email, colaborador.senha);
        assert.equal(tentativa.status, 403);
        assert.equal(tentativa.token, undefined);

        // Senha errada continua sendo credencial inválida, sem revelar o estado da conta.
        assert.equal((await login(colaborador.email, 'senha-errada-ficticia')).status, 401);
    });

    it('reativado, o funcionário volta a entrar', async () => {
        const colaborador = await novoColaborador();
        await atualizarStatus(colaborador, 'Inativo');
        await atualizarStatus(colaborador, 'Ativo');
        assert.equal((await login(colaborador.email, colaborador.senha)).status, 200);
    });

    it('o token emitido antes da inativação deixa de valer, e não volta com a reativação', async () => {
        const colaborador = await novoColaborador();
        assert.equal((await consultar(colaborador.token)).status, 200);

        await atualizarStatus(colaborador, 'Inativo');
        assert.equal((await consultar(colaborador.token)).status, 401);

        await atualizarStatus(colaborador, 'Ativo');
        assert.equal((await consultar(colaborador.token)).status, 401);
    });

    it('funcionário inativado direto no banco, sem passar pela API, também perde a sessão', async () => {
        const colaborador = await novoColaborador();
        await pool.query("UPDATE funcionarios SET status = 'Inativo' WHERE id = ?", [colaborador.funcionarioId]);
        assert.equal((await consultar(colaborador.token)).status, 401);
    });

    it('o token anterior à troca de senha deixa de consultar dados', async () => {
        const colaborador = await novoColaborador();
        const troca = await chamar('PUT', '/api/perfil/alterar-senha', colaborador.token, {
            senhaAtual: colaborador.senha, novaSenha: 'senha-nova-ficticia',
        });
        assert.equal(troca.status, 200);

        assert.equal((await consultar(colaborador.token)).status, 401);

        const novo = await login(colaborador.email, 'senha-nova-ficticia');
        assert.equal(novo.status, 200);
        assert.equal(claimsDe(novo.token).sv, 1);
        assert.equal((await consultar(novo.token)).status, 200);
    });

    it('a troca de senha de um usuário não derruba a sessão de outro', async () => {
        const [a, b] = [await novoColaborador(), await novoColaborador()];
        await chamar('PUT', '/api/perfil/alterar-senha', a.token, { senhaAtual: a.senha, novaSenha: 'senha-nova-ficticia' });
        assert.equal((await consultar(b.token)).status, 200);
    });

    it('depois de excluir usuário e funcionário, o token não autentica mais', async () => {
        const colaborador = await novoColaborador();
        assert.equal((await chamar('DELETE', `/api/funcionarios/${colaborador.funcionarioId}`, tokenAdmin)).status, 200);

        assert.equal((await consultar(colaborador.token)).status, 401);
        assert.equal((await login(colaborador.email, colaborador.senha)).status, 401);
    });

    it('administrador sem funcionário vinculado continua autenticando', async () => {
        const [{ total }] = (await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM usuarios WHERE funcionario_id IS NULL AND empresa_id = ?', [empresa]))[0];
        assert.ok(total >= 1);
        assert.equal((await chamar('GET', '/api/funcionarios', tokenAdmin)).status, 200);
    });

    it('token sem versão de sessão (emitido antes da migration) é recusado', async () => {
        const colaborador = await novoColaborador();
        const { id, perfil, empresa_id, funcionario_id } = claimsDe(colaborador.token);
        const antigo = jwt.sign({ id, perfil, empresa_id, funcionario_id }, process.env.JWT_SECRET as string, { expiresIn: '1d' });
        assert.equal((await consultar(antigo)).status, 401);
    });

    it('token expirado é recusado com 401', async () => {
        const colaborador = await novoColaborador();
        const { id, perfil, empresa_id, funcionario_id, sv } = claimsDe(colaborador.token);
        const expirado = jwt.sign({ id, perfil, empresa_id, funcionario_id, sv }, process.env.JWT_SECRET as string, { expiresIn: -10 });
        assert.equal((await consultar(expirado)).status, 401);
    });
});
