// M-14/H-19: falha inesperada vai ao Sentry quando há SENTRY_DSN; sem DSN nada é carregado nem enviado, e o
// que sai não leva cookie, cabeçalho nem corpo.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Response } from 'express';
import { descarregarSentry, iniciarSentry, registrarNoSentry } from '../shared/observabilidade/sentry.ts';
import { responderErro } from '../shared/utils/erros.ts';

describe('Sentry', () => {
    it('sem DSN não inicia e registrar é inofensivo', async () => {
        assert.equal(await iniciarSentry(undefined), false);
        assert.equal(await iniciarSentry(''), false);
        assert.doesNotThrow(() => registrarNoSentry(new Error('ninguém escuta')));
        await descarregarSentry();
    });

    it('com DSN, um 500 e um 503 de infraestrutura chegam ao Sentry; um 4xx não', async () => {
        const envelopes: unknown[] = [];
        const iniciado = await iniciarSentry('https://chave@sentry.exemplo.invalid/1', {
            transport: () => ({
                send: async (envelope) => { envelopes.push(envelope); return {}; },
                flush: async () => true,
            }),
        });
        assert.equal(iniciado, true);

        const res = (): Response => {
            const resposta = { req: { log: { error: () => {} } }, set: () => resposta, status: () => resposta, json: () => resposta };
            return resposta as unknown as Response;
        };
        responderErro(res(), new TypeError('falha-500-ficticia'), 'Erro ao buscar histórico.');
        responderErro(res(), Object.assign(new Error('falha-503-ficticia'), { code: 'ECONNREFUSED' }), 'Erro ao validar a sessão.');
        responderErro(res(), Object.assign(new Error('falha-409-ficticia'), { code: 'ER_DUP_ENTRY', sqlMessage: 'x' }), 'Erro.');
        await descarregarSentry();

        // Um envelope é [cabeçalho, [[cabeçalho do item, conteúdo], ...]]; as falhas são os itens com `exception`.
        const falhas = (envelopes as [unknown, [unknown, { exception?: { values?: { value?: string }[] } }][]][])
            .flatMap(([, itens]) => itens.map(([, conteudo]) => conteudo.exception?.values?.[0]?.value))
            .filter(Boolean)
            .sort(); // o envio é assíncrono: a ordem de chegada não é a de captura
        assert.deepEqual(falhas, ['falha-500-ficticia', 'falha-503-ficticia'], 'só o 500 e o 503 são incidentes; o 4xx de regra não');
    });
});
