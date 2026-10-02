// SEC-07: o pool tem fila e tempos finitos definidos pela aplicação. Exige um MySQL real
// (variáveis HRFLOW_TEST_DB_*); sem ele os testes são marcados como ignorados, nunca como aprovados.
const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const banco = require('./support/bancoDeTeste');

describe('pool de conexões', { skip: banco.skip }, () => {
    let configDb;
    const pools = [];
    const criar = (limites) => {
        const pool = configDb.criarPool(limites);
        pools.push(pool);
        return pool;
    };

    before(async () => {
        await banco.preparar();
        configDb = require('../config/db');
        pools.push(configDb);
    });

    after(async () => {
        await Promise.all(pools.map((pool) => pool.end()));
        await banco.encerrar();
    });

    it('declara limites finitos para a fila e os tempos', () => {
        const { connectionLimit, queueLimit, connectTimeout, maxExecutionTime } = configDb.LIMITES_POOL;
        for (const limite of [connectionLimit, queueLimit, connectTimeout, maxExecutionTime]) {
            assert.ok(Number.isInteger(limite) && limite > 0);
        }
        assert.equal(configDb.pool.config.queueLimit, queueLimit);
        assert.equal(configDb.pool.config.connectionLimit, connectionLimit);
        assert.equal(configDb.pool.config.connectionConfig.connectTimeout, connectTimeout);
    });

    it('limita a duração das consultas em toda conexão nova', async () => {
        const pool = criar({ connectionLimit: 1, maxExecutionTime: 1234 });
        const [[{ limite }]] = await pool.query('SELECT @@SESSION.max_execution_time AS limite');
        assert.equal(Number(limite), 1234);
    });

    it('interrompe a consulta que passa do tempo e a traduz em 503', async () => {
        const { traduzirErro } = require('../utils/erros');
        const pool = criar({ connectionLimit: 1, maxExecutionTime: 200 });

        // Produto cartesiano de tabelas do sistema: leva muito mais que 200 ms em qualquer máquina.
        await assert.rejects(
            pool.query('SELECT COUNT(*) FROM information_schema.columns a, information_schema.columns b, information_schema.columns c'),
            (erro) => erro.code === 'ER_QUERY_TIMEOUT' && traduzirErro(erro).status === 503
        );
    });

    it('recusa na hora quando a fila está cheia, em vez de acumular requisições', async () => {
        const { traduzirErro } = require('../utils/erros');
        const pool = criar({ connectionLimit: 1, queueLimit: 1 });

        // Uma consulta ocupa a única conexão, uma espera na fila e a terceira não cabe.
        const resultados = await Promise.allSettled([
            pool.query('SELECT SLEEP(1)'),
            pool.query('SELECT 1'),
            pool.query('SELECT 2'),
        ]);

        assert.equal(resultados[0].status, 'fulfilled');
        assert.equal(resultados[1].status, 'fulfilled');
        assert.equal(resultados[2].status, 'rejected');
        assert.equal(resultados[2].reason.message, 'Queue limit reached.');
        assert.equal(traduzirErro(resultados[2].reason).status, 503);
    });
});
