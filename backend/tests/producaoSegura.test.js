// Produção mínima segura: health e ready para monitores, 404 em JSON para rota de API inexistente,
// sem x-powered-by, sem CORS aberto e com a resposta comprimida. Banco e variáveis em
// tests/support/bancoDeTeste.js; sem HRFLOW_TEST_DB_HOST os testes de integração são pulados.
const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const banco = require('./support/bancoDeTeste');
const { criarUsuario, cabecalhosDaSessao } = require('./support/sessao');

// fetch descomprime sozinho e esconde o que trafegou: http.get mostra a resposta como saiu da API.
const pedir = (baseUrl, caminho, { metodo = 'GET', cabecalhos = {} } = {}) => new Promise((resolve, reject) => {
    const requisicao = http.request(`${baseUrl}${caminho}`, { method: metodo, headers: cabecalhos }, (resposta) => {
        const partes = [];
        resposta.on('data', (parte) => partes.push(parte));
        resposta.on('end', () => resolve({ status: resposta.statusCode, headers: resposta.headers, corpo: Buffer.concat(partes) }));
    });
    requisicao.on('error', reject);
    requisicao.end();
});

const escutar = async (app) => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
};
const fechar = (server) => new Promise((resolve) => server.close(resolve));

describe('produção mínima segura', { skip: banco.skip }, () => {
    let configDb, servidorApp, baseUrl, token;

    before(async () => {
        await banco.preparar();
        configDb = require('../shared/db/pool');
        ({ server: servidorApp, baseUrl } = await escutar(require('../server')));

        const [empresa] = await configDb.query("INSERT INTO empresas (nome) VALUES ('Empresa Ficticia')");
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
        if (configDb) await configDb.end();
        await banco.encerrar();
    });

    describe('GET /api/health', () => {
        it('responde 200 sem sessão e sem consultar o banco', async () => {
            const { criarRouter } = require('../routes/saudeRoutes');
            const expressLocal = require('express')();
            let consultas = 0;
            expressLocal.use('/api', criarRouter({ query: async () => { consultas += 1; } }));
            const { server, baseUrl: urlLocal } = await escutar(expressLocal);
            try {
                const resposta = await pedir(urlLocal, '/api/health');
                assert.equal(resposta.status, 200);
                assert.deepEqual(JSON.parse(resposta.corpo), { status: 'ok' });
                assert.equal(consultas, 0);
            } finally {
                await fechar(server);
            }
        });

        it('no app real responde 200 sem sessão', async () => {
            const resposta = await pedir(baseUrl, '/api/health');
            assert.equal(resposta.status, 200);
            assert.deepEqual(JSON.parse(resposta.corpo), { status: 'ok' });
        });
    });

    describe('GET /api/ready', () => {
        it('com o banco no ar responde 200 {"status":"ok"} sem sessão', async () => {
            const resposta = await pedir(baseUrl, '/api/ready');
            assert.equal(resposta.status, 200);
            assert.deepEqual(JSON.parse(resposta.corpo), { status: 'ok' });
        });

        it('com o pool fechado responde 503 na hora', async () => {
            const { criarRouter } = require('../routes/saudeRoutes');
            const pool = configDb.criarPool();
            await pool.end();
            const expressLocal = require('express')();
            expressLocal.use('/api', criarRouter(pool));
            const { server, baseUrl: urlLocal } = await escutar(expressLocal);
            try {
                const resposta = await pedir(urlLocal, '/api/ready');
                assert.equal(resposta.status, 503);
                assert.deepEqual(JSON.parse(resposta.corpo), { status: 'indisponivel' });
            } finally {
                await fechar(server);
            }
        });

        it('com o banco travado responde 503 dentro do prazo, não quando o banco voltar', async () => {
            const { criarRouter, PRAZO_PRONTIDAO_MS } = require('../routes/saudeRoutes');
            assert.ok(PRAZO_PRONTIDAO_MS <= 2000);
            const expressLocal = require('express')();
            // Consulta que nunca responde e que, ao falhar tarde, não pode virar rejeição não tratada.
            expressLocal.use('/api', criarRouter({ query: () => new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('tarde')), 1500)) }, { prazoMs: 300 }));
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
            assert.match(resposta.headers['content-type'], /^application\/json/);
            assert.deepEqual(JSON.parse(resposta.corpo), { erro: 'Rota não encontrada.' });
        });

        it('método sem rota dentro de um módulo existente também é 404 em JSON', async () => {
            const resposta = await pedir(baseUrl, '/api/auth/nao-existe', { metodo: 'POST' });
            assert.equal(resposta.status, 404);
            assert.match(resposta.headers['content-type'], /^application\/json/);
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
