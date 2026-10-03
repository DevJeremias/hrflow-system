// A montagem do app em app.ts: o que cada prefixo de rota exige, a ordem dos parsers e as opções do
// criarApp. É aqui que um prefixo esquecido sem authMiddleware, ou um módulo desmontado, aparece.
// Banco e variáveis em tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST os testes são pulados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import * as banco from './support/bancoDeTeste.ts';
import pool from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import { pararServidor, subirServidor } from './support/servidor.ts';

// Todo prefixo de módulo protegido, com uma rota GET que existe nele.
const PREFIXOS_PROTEGIDOS = ['/api/funcionarios', '/api/ponto', '/api/estrutura/departamentos', '/api/folha/holerites', '/api/perfil', '/api/dashboard/resumo'];

describe('montagem do app', { skip: banco.skip }, () => {
    let server: http.Server;
    let baseUrl: string;

    before(async () => {
        await banco.preparar();
        ({ server, baseUrl } = await subirServidor(criarApp()));
    });

    after(async () => {
        if (server) await pararServidor(server);
        await pool.end();
        await banco.encerrar();
    });

    it('a raiz da API responde sem sessão', async () => {
        const resposta = await fetch(`${baseUrl}/api`);
        assert.equal(resposta.status, 200);
        assert.match((await resposta.json()).mensagem, /online/);
    });

    for (const prefixo of PREFIXOS_PROTEGIDOS) {
        it(`${prefixo} exige sessão`, async () => {
            const resposta = await fetch(`${baseUrl}${prefixo}`);
            assert.equal(resposta.status, 401);
            assert.match((await resposta.json()).erro, /sessão/i);
        });
    }

    it('login e cadastro ficam fora do authMiddleware: um corpo vazio é 400, não 401', async () => {
        for (const caminho of ['/api/auth/login', '/api/auth/registrar']) {
            const resposta = await fetch(`${baseUrl}${caminho}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            assert.equal(resposta.status, 400, caminho);
        }
    });

    it('o corpo do login e do cadastro é limitado a 4 KB, antes do parser global de 4 MB', async () => {
        const resposta = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'a@exemplo.invalid', senha: 'x'.repeat(10_000) }),
        });
        assert.equal(resposta.status, 413);
    });

    it('o parser global aceita o avatar em base64 (até 4 MB) e recusa mais que isso com 413 em JSON', async () => {
        const enviar = (bytes: number) => fetch(`${baseUrl}/api/funcionarios`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar: 'x'.repeat(bytes) }),
        });
        // O parser roda antes do authMiddleware: um corpo aceito chega à rota e é recusado por falta de sessão.
        assert.equal((await enviar(3 * 1024 * 1024)).status, 401);
        const grande = await enviar(5 * 1024 * 1024);
        assert.equal(grande.status, 413);
        assert.deepEqual(await grande.json(), { erro: 'O corpo da requisição excede o limite permitido.' });
    });

    it('JSON malformado vira 400 em JSON, não a página de erro do Express', async () => {
        const resposta = await fetch(`${baseUrl}/api/funcionarios`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{quebrado' });
        assert.equal(resposta.status, 400);
        assert.deepEqual(await resposta.json(), { erro: 'Corpo da requisição inválido. Envie um JSON válido.' });
    });

    it('recusa TRUST_PROXY=true, que deixaria qualquer cliente forjar o IP do limitador', () => {
        assert.throws(() => criarApp({ trustProxy: 'true' }), /TRUST_PROXY=true/);
    });

    it('cada app tem o próprio limitador de tentativas', async () => {
        const apertado = { loginPorIp: { windowMs: 60_000, limit: 1 } };
        const tentar = (url: string) => fetch(`${url}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const a = await subirServidor(criarApp({ limitesAuth: apertado }));
        const b = await subirServidor(criarApp({ limitesAuth: apertado }));
        try {
            assert.equal((await tentar(a.baseUrl)).status, 400);
            assert.equal((await tentar(a.baseUrl)).status, 429);
            assert.equal((await tentar(b.baseUrl)).status, 400);
        } finally {
            await Promise.all([pararServidor(a.server), pararServidor(b.server)]);
        }
    });
});
