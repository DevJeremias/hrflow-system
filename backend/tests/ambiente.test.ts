// A API só sobe com a configuração mínima: o que falta é dito na partida, não vira 500 depois.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ErroDeAmbiente, lerAmbiente } from '../shared/config/ambiente.ts';

const valido = { DB_HOST: '127.0.0.1', DB_USER: 'root', DB_NAME: 'hrflow_db' };

describe('ambiente da API', () => {
    it('aceita a configuração mínima e usa a porta 3000 quando PORT não existe', () => {
        assert.deepEqual(lerAmbiente(valido), { porta: 3000, sentryDsn: undefined });
    });

    it('lê PORT e SENTRY_DSN', () => {
        assert.deepEqual(
            lerAmbiente({ ...valido, PORT: '4100', SENTRY_DSN: ' https://chave@sentry.exemplo.invalid/1 ' }),
            { porta: 4100, sentryDsn: 'https://chave@sentry.exemplo.invalid/1' },
        );
        assert.equal(lerAmbiente({ ...valido, SENTRY_DSN: '  ' }).sentryDsn, undefined);
    });

    it('DB_HOST vazio, ausente ou só com espaços impede a subida', () => {
        for (const DB_HOST of ['', '   ', undefined]) {
            assert.throws(() => lerAmbiente({ ...valido, DB_HOST }), (erro: unknown) =>
                erro instanceof ErroDeAmbiente && /DB_HOST é obrigatória/.test(erro.message));
        }
    });

    it('lista todos os problemas de uma vez', () => {
        assert.throws(() => lerAmbiente({ DB_PORT: 'abc', PORT: '70000' }), (erro: unknown) => {
            assert.ok(erro instanceof ErroDeAmbiente);
            assert.equal(erro.problemas.length, 5);
            for (const nome of ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PORT', 'PORT']) {
                assert.ok(erro.problemas.some((problema) => problema.startsWith(nome)), nome);
            }
            return true;
        });
    });

    it('recusa porta fora de 1 a 65535 ou com texto', () => {
        for (const PORT of ['0', '65536', '-1', '30x0', '3000.5']) {
            assert.throws(() => lerAmbiente({ ...valido, PORT }), /PORT deve ser/, PORT);
        }
    });

    it('DB_PASS pode ser vazia, e os limites do pool, quando informados, são inteiros positivos', () => {
        assert.doesNotThrow(() => lerAmbiente({ ...valido, DB_PASS: '', DB_CONNECTION_LIMIT: '10', DB_QUEUE_LIMIT: '50' }));
        for (const DB_QUEUE_LIMIT of ['0', '-5', 'muitos']) {
            assert.throws(() => lerAmbiente({ ...valido, DB_QUEUE_LIMIT }), /DB_QUEUE_LIMIT deve ser/);
        }
    });
});
