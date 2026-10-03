// A API só sobe com a configuração mínima: o que falta é dito na partida, não vira 500 depois.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ErroDeAmbiente, lerAmbiente } from '../shared/config/ambiente.ts';

const valido = { DB_HOST: '127.0.0.1', DB_USER: 'root', DB_NAME: 'hrflow_db' };

describe('ambiente da API', () => {
    it('aceita a configuração mínima e usa a porta 3000 quando PORT não existe', () => {
        assert.deepEqual(lerAmbiente(valido), { porta: 3000, sentryDsn: undefined, email: null });
    });

    it('lê PORT e SENTRY_DSN', () => {
        assert.deepEqual(
            lerAmbiente({ ...valido, PORT: '4100', SENTRY_DSN: ' https://chave@sentry.exemplo.invalid/1 ' }),
            { porta: 4100, sentryDsn: 'https://chave@sentry.exemplo.invalid/1', email: null },
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

    it('recusa porta fora de 0 a 65535 ou com texto; PORT=0 pede ao sistema uma porta livre', () => {
        for (const PORT of ['65536', '-1', '30x0', '3000.5']) {
            assert.throws(() => lerAmbiente({ ...valido, PORT }), /PORT deve ser/, PORT);
        }
        assert.equal(lerAmbiente({ ...valido, PORT: '0' }).porta, 0);
    });

    it('DB_PASS pode ser vazia, e os limites do pool, quando informados, são inteiros positivos', () => {
        assert.doesNotThrow(() => lerAmbiente({ ...valido, DB_PASS: '', DB_CONNECTION_LIMIT: '10', DB_QUEUE_LIMIT: '50' }));
        for (const DB_QUEUE_LIMIT of ['0', '-5', 'muitos']) {
            assert.throws(() => lerAmbiente({ ...valido, DB_QUEUE_LIMIT }), /DB_QUEUE_LIMIT deve ser/);
        }
    });

    describe('e-mail transacional', () => {
        const com = { ...valido, EMAIL_TRANSPORT: 'ses', EMAIL_FROM: 'HRFlow <nao-responder@exemplo.com.br>', APP_URL: 'https://hrflow.exemplo.com.br/' };

        it('sem EMAIL_TRANSPORT não há e-mail, e nada mais é exigido', () => {
            assert.equal(lerAmbiente({ ...valido, EMAIL_FROM: 'lixo', APP_URL: 'lixo' }).email, null);
            assert.equal(lerAmbiente({ ...valido, EMAIL_TRANSPORT: '  ' }).email, null);
        });

        it('lê o transporte, o remetente e o endereço do app sem a barra final', () => {
            assert.deepEqual(lerAmbiente(com).email, {
                transporte: 'ses', remetente: 'HRFlow <nao-responder@exemplo.com.br>', urlDoApp: 'https://hrflow.exemplo.com.br',
            });
            assert.equal(lerAmbiente({ ...com, EMAIL_FROM: 'nao-responder@exemplo.com.br' }).email?.remetente, 'nao-responder@exemplo.com.br');
            assert.equal(lerAmbiente({ ...com, EMAIL_TRANSPORT: 'log', APP_URL: 'http://localhost:5173' }).email?.transporte, 'log');
        });

        it('transporte desconhecido, remetente e endereço inválidos impedem a subida, todos de uma vez', () => {
            assert.throws(() => lerAmbiente({ ...com, EMAIL_TRANSPORT: 'smtp' }), /EMAIL_TRANSPORT deve ser/);
            assert.throws(() => lerAmbiente({ ...com, EMAIL_FROM: undefined }), /EMAIL_FROM é obrigatória/);
            assert.throws(() => lerAmbiente({ ...com, EMAIL_FROM: 'sem arroba' }), /EMAIL_FROM é obrigatória/);
            for (const APP_URL of [undefined, 'hrflow.exemplo.com.br', 'https://hrflow.exemplo.com.br/painel']) {
                assert.throws(() => lerAmbiente({ ...com, APP_URL }), /APP_URL é obrigatória/, String(APP_URL));
            }
            assert.throws(() => lerAmbiente({ ...valido, EMAIL_TRANSPORT: 'ses' }), (erro: unknown) =>
                erro instanceof ErroDeAmbiente && erro.problemas.length === 2);
        });

        it('o transporte de log não vale em produção, porque o log guardaria os tokens de redefinição', () => {
            assert.throws(() => lerAmbiente({ ...com, EMAIL_TRANSPORT: 'log', NODE_ENV: 'production' }), /não é permitido em produção/);
            assert.equal(lerAmbiente({ ...com, NODE_ENV: 'production' }).email?.transporte, 'ses');
        });
    });
});
