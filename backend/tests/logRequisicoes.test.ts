// H-19: toda requisição gera uma linha JSON com reqId, método, rota, status, duração, usuarioId e empresaId,
// e a linha nunca leva corpo, cookie nem token. O teste lê o stream do pino, como o Docker leria.
// Banco e variáveis em tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST o teste é pulado.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import type { ResultSetHeader } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { cabecalhosDaSessao, criarUsuario } from './support/sessao.ts';
import { criarLoggerCapturado } from './support/logCapturado.ts';
import { pararServidor, subirServidor } from './support/servidor.ts';
import pool from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';

describe('log por requisição', { skip: banco.skip }, () => {
    const { logger, linhas } = criarLoggerCapturado();
    let server: http.Server;
    let baseUrl: string;
    let empresaId: number;

    // A linha é escrita quando a resposta termina, um instante depois de o cliente a receber.
    const linhaDaRequisicao = async (reqId: string | null) => {
        for (let tentativa = 0; tentativa < 50; tentativa += 1) {
            const linha = linhas.find((candidata) => candidata.reqId === reqId && 'status' in candidata);
            if (linha) return linha;
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.fail(`nenhuma linha de log para o reqId ${reqId}`);
    };

    before(async () => {
        await banco.preparar();
        const [empresa] = await pool.query<ResultSetHeader>('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia Log']);
        empresaId = empresa.insertId;
        ({ server, baseUrl } = await subirServidor(criarApp({ logger })));
    });

    after(async () => {
        await pararServidor(server);
        await pool.end();
        await banco.encerrar();
    });

    it('requisição autenticada: reqId, método, rota, status, duração, usuarioId e empresaId', async () => {
        const { usuario, token } = await criarUsuario(pool, { empresaId, perfil: 'Administrador' });
        const resposta = await fetch(`${baseUrl}/api/auth/sessao`, { headers: cabecalhosDaSessao(token) });
        assert.equal(resposta.status, 200);

        const linha = await linhaDaRequisicao(resposta.headers.get('x-request-id'));
        assert.equal(linha.metodo, 'GET');
        assert.equal(linha.rota, '/api/auth/sessao');
        assert.equal(linha.status, 200);
        assert.equal(typeof linha.duracaoMs, 'number');
        assert.ok((linha.duracaoMs as number) >= 0);
        assert.equal(linha.usuarioId, usuario.id);
        assert.equal(linha.empresaId, empresaId);
        assert.equal(linha.nivel, 'info');
        assert.match(String(linha.time), /^\d{4}-\d{2}-\d{2}T/);
    });

    it('a rota é o padrão do Express e a query string não vai para o log', async () => {
        const { token } = await criarUsuario(pool, { empresaId, perfil: 'Administrador' });
        const resposta = await fetch(`${baseUrl}/api/funcionarios/9999?busca=segredo-do-usuario`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
            body: '{}',
        });
        const linha = await linhaDaRequisicao(resposta.headers.get('x-request-id'));
        assert.equal(linha.rota, '/api/funcionarios/:id');
        assert.ok(!JSON.stringify(linha).includes('segredo-do-usuario'));
    });

    it('requisição sem sessão sai com status 401, nível warn e sem usuarioId', async () => {
        const resposta = await fetch(`${baseUrl}/api/dashboard/resumo`);
        assert.equal(resposta.status, 401);
        const linha = await linhaDaRequisicao(resposta.headers.get('x-request-id'));
        assert.equal(linha.status, 401);
        assert.equal(linha.nivel, 'warn');
        assert.equal(linha.usuarioId, undefined);
        assert.equal(linha.empresaId, undefined);
    });

    it('rota inexistente também é registrada, com o caminho sem a query string', async () => {
        const resposta = await fetch(`${baseUrl}/api/nao-existe?token=abc`);
        assert.equal(resposta.status, 404);
        const linha = await linhaDaRequisicao(resposta.headers.get('x-request-id'));
        assert.equal(linha.rota, '/api/nao-existe');
        assert.equal(linha.status, 404);
    });

    it('nunca registra o corpo, o cookie, o token nem a senha', async () => {
        const { token } = await criarUsuario(pool, { empresaId, perfil: 'Administrador' });
        const senha = 'senha-que-nao-pode-vazar-9';
        const login = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
            body: JSON.stringify({ email: 'ninguem@exemplo.invalid', senha }),
        });
        await linhaDaRequisicao(login.headers.get('x-request-id'));
        await fetch(`${baseUrl}/api/auth/sessao`, { headers: cabecalhosDaSessao(token) });

        const tudo = JSON.stringify(linhas);
        assert.ok(!tudo.includes(senha), 'a senha do corpo apareceu no log');
        assert.ok(!tudo.includes(token), 'o token da sessão apareceu no log');
        assert.ok(!tudo.includes('ninguem@exemplo.invalid'), 'o corpo apareceu no log');
        assert.ok(!/cookie|authorization/i.test(tudo), 'um cabeçalho sensível apareceu no log');
    });

    it('o reqId vai no cabeçalho X-Request-Id; um id válido do proxy é mantido e um inválido é trocado', async () => {
        const gerado = await fetch(`${baseUrl}/api/health`);
        assert.match(gerado.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);

        const doProxy = await fetch(`${baseUrl}/api/health`, { headers: { 'X-Request-Id': 'caddy-0123456789abcdef' } });
        assert.equal(doProxy.headers.get('x-request-id'), 'caddy-0123456789abcdef');
        assert.equal((await linhaDaRequisicao('caddy-0123456789abcdef')).rota, '/api/health');

        const invalido = await fetch(`${baseUrl}/api/health`, { headers: { 'X-Request-Id': 'a b\t"quebra"' } });
        assert.match(invalido.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
    });
});
