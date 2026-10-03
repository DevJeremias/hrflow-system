// SEC-07: o pool tem fila e tempos finitos definidos pela aplicação. Exige um MySQL real
// (variáveis HRFLOW_TEST_DB_*); sem ele os testes são marcados como ignorados, nunca como aprovados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import pool, { criarPool, LIMITES_POOL } from '../shared/db/pool.ts';
import { traduzirErro } from '../shared/utils/erros.ts';

describe('pool de conexões', { skip: banco.skip }, () => {
    const pools: Pool[] = [pool];
    const criar = (limites: Partial<typeof LIMITES_POOL>) => {
        const novo = criarPool(limites);
        pools.push(novo);
        return novo;
    };

    before(async () => {
        await banco.preparar();
    });

    after(async () => {
        await Promise.all(pools.map((aberto) => aberto.end()));
        await banco.encerrar();
    });

    it('declara limites finitos para a fila e os tempos', () => {
        const { connectionLimit, queueLimit, connectTimeout, maxExecutionTime } = LIMITES_POOL;
        for (const limite of [connectionLimit, queueLimit, connectTimeout, maxExecutionTime]) {
            assert.ok(Number.isInteger(limite) && limite > 0);
        }
        assert.equal(pool.pool.config.queueLimit, queueLimit);
        assert.equal(pool.pool.config.connectionLimit, connectionLimit);
        const { connectionConfig } = pool.pool.config as unknown as { connectionConfig: { connectTimeout: number } };
        assert.equal(connectionConfig.connectTimeout, connectTimeout);
    });

    it('limita a duração das consultas em toda conexão nova', async () => {
        const limitado = criar({ connectionLimit: 1, maxExecutionTime: 1234 });
        const [[{ limite }]] = await limitado.query<RowDataPacket[]>('SELECT @@SESSION.max_execution_time AS limite');
        assert.equal(Number(limite), 1234);
    });

    it('interrompe a consulta que passa do tempo e a traduz em 503', async () => {
        const limitado = criar({ connectionLimit: 1, maxExecutionTime: 200 });

        // Produto cartesiano de tabelas do sistema: leva muito mais que 200 ms em qualquer máquina.
        await assert.rejects(
            limitado.query('SELECT COUNT(*) FROM information_schema.columns a, information_schema.columns b, information_schema.columns c'),
            (erro: { code?: string }) => erro.code === 'ER_QUERY_TIMEOUT' && traduzirErro(erro)?.status === 503
        );
    });

    it('recusa na hora quando a fila está cheia, em vez de acumular requisições', async () => {
        const limitado = criar({ connectionLimit: 1, queueLimit: 1 });

        // Uma consulta ocupa a única conexão, uma espera na fila e a terceira não cabe.
        const resultados = await Promise.allSettled([
            limitado.query('SELECT SLEEP(1)'),
            limitado.query('SELECT 1'),
            limitado.query('SELECT 2'),
        ]);

        assert.equal(resultados[0].status, 'fulfilled');
        assert.equal(resultados[1].status, 'fulfilled');
        assert.equal(resultados[2].status, 'rejected');
        assert.equal((resultados[2] as PromiseRejectedResult).reason.message, 'Queue limit reached.');
        assert.equal(traduzirErro((resultados[2] as PromiseRejectedResult).reason)?.status, 503);
    });
});
