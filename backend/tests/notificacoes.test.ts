// Notificações: o sino do colaborador (GET /api/notificacoes), a geração nos eventos (decisão de uma
// justificativa, fechamento da folha) e o e-mail opcional. MySQL real e descartável
// (tests/support/bancoDeTeste.ts); sem HRFLOW_TEST_DB_HOST o teste é pulado.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import type { RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarColaborador, criarEmpresa, criarFuncionario } from './support/empresas.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import { subirServidor, pararServidor } from './support/servidor.ts';
import db from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import { configurarEmail } from '../shared/email/email.ts';
import type { Email } from '../shared/email/email.ts';
import { criarFuso } from '../shared/utils/fuso.ts';

const DIA = '2026-03-10';

describe('notificações', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let baseUrl: string;

    const chamar = async (metodo: string, caminho: string, token: string | undefined, corpo?: unknown) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        const texto = await resposta.text();
        return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
    };

    // Uma empresa com RH e dois colaboradores com conta, um deles com uma justificativa pendente.
    const cenario = async () => {
        const { empresaId } = await criarEmpresa(db);
        const admin = (await criarUsuario(db, { empresaId, perfil: 'Administrador' })).token;
        const rh = (await criarUsuario(db, { empresaId, perfil: 'RH' })).token;
        const caio = await criarColaborador(db, empresaId, { nome: 'Caio Colaborador Ficticio', salario: 3000, admissao: '2024-01-02' });
        const dora = await criarColaborador(db, empresaId, { nome: 'Dora Colaboradora Ficticia', salario: 4000, admissao: '2024-01-02' });
        // Eva entra na folha mas não tem conta de acesso: não há a quem avisar.
        await criarFuncionario(db, empresaId, { nome: 'Eva Sem Conta Ficticia', salario: 2500 });
        await db.query(
            'INSERT INTO justificativas_ponto (empresa_id, funcionario_id, data_referencia, texto) VALUES (?, ?, ?, ?)',
            [empresaId, caio.funcionarioId, DIA, 'Consulta médica.']
        );
        const [[{ id: justificativa }]] = await db.query<RowDataPacket[]>('SELECT id FROM justificativas_ponto WHERE funcionario_id = ?', [caio.funcionarioId]);
        return { empresaId, admin, rh, caio, dora, justificativa: justificativa as number };
    };

    before(async () => {
        await banco.preparar();
        ({ server: servidor, baseUrl } = await subirServidor(criarApp()));
    });

    afterEach(() => { configurarEmail(null); });

    after(async () => {
        await pararServidor(servidor);
        await db.end();
        await banco.encerrar();
    });

    it('aprovar uma justificativa avisa o colaborador, e o sino mostra "1 não lida"', async () => {
        const { rh, caio, justificativa } = await cenario();
        assert.deepEqual((await chamar('GET', '/api/notificacoes', caio.token)).corpo, { naoLidas: 0, itens: [] });

        const decisao = await chamar('PATCH', `/api/ponto/justificativas/${justificativa}`, rh, { status: 'aprovada' });
        assert.equal(decisao.status, 200, JSON.stringify(decisao.corpo));

        const { status, corpo } = await chamar('GET', '/api/notificacoes', caio.token);
        assert.equal(status, 200);
        assert.equal(corpo.naoLidas, 1);
        assert.equal(corpo.itens.length, 1);
        assert.deepEqual(
            { tipo: corpo.itens[0].tipo, titulo: corpo.itens[0].titulo, mensagem: corpo.itens[0].mensagem, link: corpo.itens[0].link, lida: corpo.itens[0].lida },
            { tipo: 'justificativa', titulo: 'Justificativa aprovada', mensagem: 'A sua justificativa do dia 10/03/2026 foi aprovada.', link: '/meu-painel', lida: false },
        );
        assert.match(corpo.itens[0].criadaEm, /^\d{4}-\d{2}-\d{2}T/);
    });

    it('recusar leva o motivo da recusa no aviso, e decidir outra vez avisa de novo', async () => {
        const { rh, caio, justificativa } = await cenario();
        await chamar('PATCH', `/api/ponto/justificativas/${justificativa}`, rh, { status: 'recusada', resposta: 'Falta o atestado.' });
        const { corpo } = await chamar('GET', '/api/notificacoes', caio.token);
        assert.equal(corpo.itens[0].titulo, 'Justificativa recusada');
        assert.equal(corpo.itens[0].mensagem, 'A sua justificativa do dia 10/03/2026 foi recusada. Resposta do RH: Falta o atestado.');

        await chamar('PATCH', `/api/ponto/justificativas/${justificativa}`, rh, { status: 'aprovada' });
        assert.equal((await chamar('GET', '/api/notificacoes', caio.token)).corpo.naoLidas, 2);
    });

    it('a decisão recusada pelas regras não gera aviso', async () => {
        const { rh, caio, justificativa } = await cenario();
        const semMotivo = await chamar('PATCH', `/api/ponto/justificativas/${justificativa}`, rh, { status: 'recusada' });
        assert.equal(semMotivo.status, 400);
        assert.equal((await chamar('GET', '/api/notificacoes', caio.token)).corpo.naoLidas, 0);
    });

    it('cada pessoa vê só os próprios avisos, nem o RH que decidiu nem outra empresa', async () => {
        const alfa = await cenario();
        const beta = await cenario();
        await chamar('PATCH', `/api/ponto/justificativas/${alfa.justificativa}`, alfa.rh, { status: 'aprovada' });
        for (const outro of [alfa.rh, alfa.admin, alfa.dora.token, beta.caio.token, beta.rh]) {
            assert.deepEqual((await chamar('GET', '/api/notificacoes', outro)).corpo, { naoLidas: 0, itens: [] });
        }
    });

    it('marcar como lida zera a contagem; a primeira leitura vale e o aviso alheio é 404', async () => {
        const alfa = await cenario();
        const beta = await cenario();
        await chamar('PATCH', `/api/ponto/justificativas/${alfa.justificativa}`, alfa.rh, { status: 'aprovada' });
        const [aviso] = (await chamar('GET', '/api/notificacoes', alfa.caio.token)).corpo.itens;

        assert.equal((await chamar('POST', `/api/notificacoes/${aviso.id}/lida`, alfa.dora.token)).status, 404);
        assert.equal((await chamar('POST', `/api/notificacoes/${aviso.id}/lida`, beta.caio.token)).status, 404);
        assert.equal((await chamar('GET', '/api/notificacoes', alfa.caio.token)).corpo.naoLidas, 1);

        const lida = await chamar('POST', `/api/notificacoes/${aviso.id}/lida`, alfa.caio.token);
        assert.deepEqual(lida, { status: 200, corpo: { naoLidas: 0 } });
        assert.equal((await chamar('POST', `/api/notificacoes/${aviso.id}/lida`, alfa.caio.token)).status, 200);
        const depois = await chamar('GET', '/api/notificacoes', alfa.caio.token);
        assert.equal(depois.corpo.itens[0].lida, true);
        assert.equal((await chamar('POST', '/api/notificacoes/abc/lida', alfa.caio.token)).status, 400);
    });

    it('marcar todas como lidas', async () => {
        const { rh, caio, justificativa } = await cenario();
        await chamar('PATCH', `/api/ponto/justificativas/${justificativa}`, rh, { status: 'recusada', resposta: 'Sem atestado.' });
        await chamar('PATCH', `/api/ponto/justificativas/${justificativa}`, rh, { status: 'aprovada' });
        assert.equal((await chamar('GET', '/api/notificacoes', caio.token)).corpo.naoLidas, 2);
        assert.deepEqual((await chamar('POST', '/api/notificacoes/lidas', caio.token)).corpo, { naoLidas: 0 });
        const { corpo } = await chamar('GET', '/api/notificacoes', caio.token);
        assert.equal(corpo.naoLidas, 0);
        assert.equal(corpo.itens.length, 2);
    });

    it('a lista traz os mais recentes primeiro e respeita o limite', async () => {
        const { rh, caio, justificativa } = await cenario();
        for (const status of ['aprovada', 'recusada', 'aprovada']) {
            await chamar('PATCH', `/api/ponto/justificativas/${justificativa}`, rh, { status, resposta: 'Motivo.' });
        }
        const { corpo } = await chamar('GET', '/api/notificacoes?limite=2', caio.token);
        assert.equal(corpo.naoLidas, 3);
        assert.deepEqual(corpo.itens.map((n: { titulo: string }) => n.titulo), ['Justificativa aprovada', 'Justificativa recusada']);
        for (const limite of ['0', '101', 'x']) {
            assert.equal((await chamar('GET', `/api/notificacoes?limite=${limite}`, caio.token)).status, 400, limite);
        }
    });

    it('fechar a folha avisa quem tem holerite e conta de acesso, uma vez só', async () => {
        const { admin, caio, dora } = await cenario();
        const competencia = criarFuso('America/Belem').mesLocal(Math.floor(Date.now() / 1000));
        assert.equal((await chamar('POST', `/api/folha/competencias/${competencia}/processar`, admin)).status, 201);
        assert.equal((await chamar('GET', '/api/notificacoes', caio.token)).corpo.naoLidas, 0, 'folha aberta não avisa');
        assert.equal((await chamar('POST', `/api/folha/competencias/${competencia}/fechar`, admin)).status, 200);

        for (const colaborador of [caio, dora]) {
            const { corpo } = await chamar('GET', '/api/notificacoes', colaborador.token);
            assert.equal(corpo.naoLidas, 1);
            assert.equal(corpo.itens[0].tipo, 'holerite');
            assert.match(corpo.itens[0].titulo, /^Holerite de \d{2}\/\d{4} disponível$/);
            assert.equal(corpo.itens[0].link, '/meu-painel/holerites');
        }
        assert.equal((await chamar('POST', `/api/folha/competencias/${competencia}/fechar`, admin)).status, 409);
        assert.equal((await chamar('GET', '/api/notificacoes', caio.token)).corpo.naoLidas, 1, 'fechar de novo não duplica');
    });

    it('sem sessão a API responde 401', async () => {
        assert.equal((await chamar('GET', '/api/notificacoes', undefined)).status, 401);
        assert.equal((await chamar('POST', '/api/notificacoes/lidas', undefined)).status, 401);
    });

    describe('e-mail', () => {
        const enviados: Email[] = [];
        const configurar = (falha = false) => {
            enviados.length = 0;
            configurarEmail({
                transporte: { enviar: async (email) => { if (falha) throw new Error('SES fora do ar'); enviados.push(email); } },
                remetente: 'HRFlow <nao-responder@exemplo.invalid>',
                urlDoApp: 'https://hrflow.exemplo.invalid',
            });
        };
        const esperarEnvios = async (quantos: number) => {
            for (let i = 0; i < 100 && enviados.length < quantos; i += 1) await new Promise((r) => setTimeout(r, 20));
        };

        it('com o e-mail configurado, o aviso também sai por e-mail em pt-BR, com o link do app', async () => {
            const { rh, caio, justificativa } = await cenario();
            configurar();
            await chamar('PATCH', `/api/ponto/justificativas/${justificativa}`, rh, { status: 'recusada', resposta: 'Falta o atestado.' });
            await esperarEnvios(1);
            assert.equal(enviados.length, 1);
            const [email] = enviados;
            const [[{ email: enderecoDoCaio }]] = await db.query<RowDataPacket[]>('SELECT email FROM usuarios WHERE id = ?', [caio.usuario.id]);
            assert.equal(email.para.email, enderecoDoCaio);
            assert.equal(email.assunto, 'Justificativa recusada');
            assert.match(email.texto, /Resposta do RH: Falta o atestado\./);
            assert.match(email.texto, /https:\/\/hrflow\.exemplo\.invalid\/meu-painel/);
            assert.match(email.html, /<html lang="pt-BR">/);
            assert.match(email.html, /href="https:\/\/hrflow\.exemplo\.invalid\/meu-painel"/);
        });

        it('sem e-mail configurado nada é enviado e o aviso na tela continua', async () => {
            const { rh, caio, justificativa } = await cenario();
            await chamar('PATCH', `/api/ponto/justificativas/${justificativa}`, rh, { status: 'aprovada' });
            assert.equal((await chamar('GET', '/api/notificacoes', caio.token)).corpo.naoLidas, 1);
        });

        it('o transporte fora do ar não desfaz a decisão nem o aviso na tela', async () => {
            const { rh, caio, justificativa } = await cenario();
            configurar(true);
            const decisao = await chamar('PATCH', `/api/ponto/justificativas/${justificativa}`, rh, { status: 'aprovada' });
            assert.equal(decisao.status, 200);
            assert.equal((await chamar('GET', '/api/notificacoes', caio.token)).corpo.naoLidas, 1);
        });

        it('um nome com HTML não vira marcação no e-mail', async () => {
            const { empresaId, rh, justificativa } = await cenario();
            const malicioso = await criarColaborador(db, empresaId, { nome: '<script>alert(1)</script>', salario: 3000 });
            await db.query('UPDATE justificativas_ponto SET funcionario_id = ? WHERE id = ?', [malicioso.funcionarioId, justificativa]);
            await db.query('UPDATE usuarios SET nome = ? WHERE id = ?', ['<img src=x onerror=alert(1)>', malicioso.usuario.id]);
            configurar();
            await chamar('PATCH', `/api/ponto/justificativas/${justificativa}`, rh, { status: 'aprovada' });
            await esperarEnvios(1);
            assert.equal(enviados.length, 1);
            assert.doesNotMatch(enviados[0].html, /<img|<script/);
            assert.match(enviados[0].html, /Olá, &lt;img\./);
        });
    });
});
