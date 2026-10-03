// Produção mínima segura: health e ready para monitores, 404 em JSON para rota de API inexistente,
// sem x-powered-by, sem CORS aberto e com a resposta comprimida. Banco e variáveis em
// tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST os testes de integração são pulados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import zlib from 'node:zlib';
import express from 'express';
import type { ResultSetHeader } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import configDb, { criarPool } from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import { criarSaudeRouter, PRAZO_PRONTIDAO_MS } from '../modules/saude/index.ts';

// fetch descomprime sozinho e esconde o que trafegou: http.get mostra a resposta como saiu da API.
interface Resposta {
    status: number | undefined;
    headers: http.IncomingHttpHeaders;
    corpo: Buffer;
}

const pedir = (baseUrl: string, caminho: string, { metodo = 'GET', cabecalhos = {} }: { metodo?: string; cabecalhos?: http.OutgoingHttpHeaders } = {}) => new Promise<Resposta>((resolve, reject) => {
    const requisicao = http.request(`${baseUrl}${caminho}`, { method: metodo, headers: cabecalhos }, (resposta) => {
        const partes: Buffer[] = [];
        resposta.on('data', (parte) => partes.push(parte));
        resposta.on('end', () => resolve({ status: resposta.statusCode, headers: resposta.headers, corpo: Buffer.concat(partes) }));
    });
    requisicao.on('error', reject);
    requisicao.end();
});

const escutar = async (aplicacao: http.RequestListener) => {
    const server = http.createServer(aplicacao);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
};
const fechar = (server: http.Server) => new Promise<void>((resolve) => server.close(() => resolve()));

describe('produção mínima segura', { skip: banco.skip }, () => {
    let servidorApp: http.Server, baseUrl: string, token: string;

    before(async () => {
        await banco.preparar();
        ({ server: servidorApp, baseUrl } = await escutar(criarApp()));

        const [empresa] = await configDb.query<ResultSetHeader>("INSERT INTO empresas (nome) VALUES ('Empresa Ficticia')");
        ({ token } = await criarUsuario(configDb, { empresaId: empresa.insertId, perfil: 'Administrador' }));
        // Mais que o limiar de 1 KB da compressão, para a listagem de funcionários valer a pena comprimir.
        for (let i = 0; i < 30; i += 1) {
            await configDb.query(
                "INSERT INTO funcionarios (nome, email, data_admissao, empresa_id) VALUES (?, ?, '2024-01-02', ?)",
                [`Funcionario Ficticio Com Nome Longo ${i}`, `comprime${i}@exemplo.invalid`, empresa.insertId]
            );
        }
    });

    after(async () => {
        if (servidorApp) await fechar(servidorApp);
        await configDb.end();
        await banco.encerrar();
    });

    describe('GET /api/health', () => {
        it('responde 200 sem sessão e sem consultar o banco', async () => {
            let consultas = 0;
            const { server, baseUrl: urlLocal } = await escutar(criarApp({ db: { query: async () => { consultas += 1; } } }));
            try {
                const resposta = await pedir(urlLocal, '/api/health');
                assert.equal(resposta.status, 200);
                assert.deepEqual(JSON.parse(resposta.corpo.toString()), { status: 'ok' });
                assert.equal(consultas, 0);
            } finally {
                await fechar(server);
            }
        });

        it('no app real responde 200 sem sessão', async () => {
            const resposta = await pedir(baseUrl, '/api/health');
            assert.equal(resposta.status, 200);
            assert.deepEqual(JSON.parse(resposta.corpo.toString()), { status: 'ok' });
        });
    });

    describe('GET /api/ready', () => {
        it('com o banco no ar responde 200 {"status":"ok"} sem sessão', async () => {
            const resposta = await pedir(baseUrl, '/api/ready');
            assert.equal(resposta.status, 200);
            assert.deepEqual(JSON.parse(resposta.corpo.toString()), { status: 'ok' });
        });

        it('com o pool fechado responde 503 na hora', async () => {
            const pool = criarPool();
            await pool.end();
            const { server, baseUrl: urlLocal } = await escutar(criarApp({ db: pool }));
            try {
                const resposta = await pedir(urlLocal, '/api/ready');
                assert.equal(resposta.status, 503);
                assert.deepEqual(JSON.parse(resposta.corpo.toString()), { status: 'indisponivel' });
            } finally {
                await fechar(server);
            }
        });

        it('com o banco travado responde 503 dentro do prazo, não quando o banco voltar', async () => {
            assert.ok(PRAZO_PRONTIDAO_MS <= 2000);
            const expressLocal = express();
            // Consulta que nunca responde e que, ao falhar tarde, não pode virar rejeição não tratada.
            expressLocal.use('/api', criarSaudeRouter({ query: () => new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('tarde')), 1500)) }, { prazoMs: 300 }));
            const { server, baseUrl: urlLocal } = await escutar(expressLocal);
            try {
                const inicio = Date.now();
                const resposta = await pedir(urlLocal, '/api/ready');
                assert.equal(resposta.status, 503);
                assert.ok(Date.now() - inicio < 1000, 'o 503 deveria vir no prazo, sem esperar o banco');
            } finally {
                await fechar(server);
            }
        });
    });

    describe('rota de API inexistente', () => {
        it('GET responde 404 em JSON, não em HTML', async () => {
            const resposta = await pedir(baseUrl, '/api/rota-inexistente');
            assert.equal(resposta.status, 404);
            assert.match(resposta.headers['content-type'] as string, /^application\/json/);
            assert.deepEqual(JSON.parse(resposta.corpo.toString()), { erro: 'Rota não encontrada.' });
        });

        it('método sem rota dentro de um módulo existente também é 404 em JSON', async () => {
            const resposta = await pedir(baseUrl, '/api/auth/nao-existe', { metodo: 'POST' });
            assert.equal(resposta.status, 404);
            assert.match(resposta.headers['content-type'] as string, /^application\/json/);
        });

        it('a rota protegida continua exigindo sessão (401, não 404)', async () => {
            const resposta = await pedir(baseUrl, '/api/funcionarios');
            assert.equal(resposta.status, 401);
        });
    });

    describe('cabeçalhos', () => {
        it('não anuncia o framework', async () => {
            const resposta = await pedir(baseUrl, '/api');
            assert.equal(resposta.status, 200);
            assert.equal(resposta.headers['x-powered-by'], undefined);
        });

        it('preflight de origem externa não recebe Access-Control-Allow-Origin', async () => {
            const resposta = await pedir(baseUrl, '/api/auth/login', {
                metodo: 'OPTIONS',
                cabecalhos: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
            });
            assert.equal(resposta.headers['access-control-allow-origin'], undefined);
        });

        it('resposta simples a uma origem externa também não recebe Access-Control-Allow-Origin', async () => {
            const resposta = await pedir(baseUrl, '/api', { cabecalhos: { Origin: 'https://evil.example' } });
            assert.equal(resposta.headers['access-control-allow-origin'], undefined);
        });
    });

    describe('compressão', () => {
        it('GET /api/funcionarios com Accept-Encoding: gzip volta comprimido e íntegro', async () => {
            const resposta = await pedir(baseUrl, '/api/funcionarios?limite=100', {
                cabecalhos: { 'Accept-Encoding': 'gzip', ...cabecalhosDaSessao(token) },
            });
            assert.equal(resposta.status, 200);
            assert.equal(resposta.headers['content-encoding'], 'gzip');
            const descomprimido = zlib.gunzipSync(resposta.corpo).toString('utf8');
            assert.ok(descomprimido.length > resposta.corpo.length);
            assert.match(descomprimido, /Funcionario Ficticio Com Nome Longo/);
        });

        it('sem Accept-Encoding a resposta sai sem compressão', async () => {
            const resposta = await pedir(baseUrl, '/api/funcionarios?limite=100', {
                cabecalhos: { 'Accept-Encoding': 'identity', ...cabecalhosDaSessao(token) },
            });
            assert.equal(resposta.status, 200);
            assert.equal(resposta.headers['content-encoding'], undefined);
        });
    });
});
