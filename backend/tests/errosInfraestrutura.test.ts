// Banco fora do ar, conexão perdida e fila cheia viram 503 com Retry-After; o resto continua 500, e todo
// 5xx vai ao log com o reqId da requisição.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Response } from 'express';
import { responderErro, traduzirErro } from '../shared/utils/erros.ts';
import { criarLoggerCapturado } from './support/logCapturado.ts';

const comCodigo = (code: string) => Object.assign(new Error(`falha ${code}`), { code });

// O mínimo de Response que responderErro usa.
const respostaFalsa = (log?: unknown) => {
    const registro: { status?: number; corpo?: unknown; cabecalhos: Record<string, string> } = { cabecalhos: {} };
    const res = {
        req: { log },
        set(nome: string, valor: string) { registro.cabecalhos[nome] = valor; return res; },
        status(codigo: number) { registro.status = codigo; return res; },
        json(corpo: unknown) { registro.corpo = corpo; return res; },
    };
    return { res: res as unknown as Response, registro };
};

describe('falhas de infraestrutura', () => {
    it('conexão recusada, expirada, perdida, sem vaga ou sem rota até o banco viram 503 com Retry-After', () => {
        const codigos = ['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR', 'ECONNRESET', 'EHOSTUNREACH', 'ENOTFOUND', 'EAI_AGAIN'];
        for (const code of codigos) {
            const traduzido = traduzirErro(comCodigo(code));
            assert.equal(traduzido?.status, 503, code);
            assert.ok(Number(traduzido?.retryAfter) > 0, `${code} deve mandar Retry-After`);
        }
    });

    it('fila cheia do pool também é 503 com Retry-After', () => {
        const traduzido = traduzirErro(new Error('Queue limit reached.'));
        assert.equal(traduzido?.status, 503);
        assert.ok(Number(traduzido?.retryAfter) > 0);
    });

    it('o que não se reconhece segue como erro interno', () => {
        assert.equal(traduzirErro(new Error('algo inesperado')), null);
        assert.equal(traduzirErro(comCodigo('ER_QUALQUER_OUTRO')), null);
    });

    it('responderErro responde 503 com o cabeçalho e registra o incidente com o logger da requisição', () => {
        const { logger, linhas } = criarLoggerCapturado();
        const { res, registro } = respostaFalsa(logger.child({ reqId: 'req-1234' }));
        responderErro(res, comCodigo('ECONNREFUSED'), 'Erro ao validar a sessão.');

        assert.equal(registro.status, 503);
        assert.equal(registro.cabecalhos['Retry-After'], '5');
        assert.match(JSON.stringify(registro.corpo), /indispon/);
        assert.equal(linhas.length, 1);
        assert.equal(linhas[0].reqId, 'req-1234');
        assert.equal(linhas[0].nivel, 'error');
        assert.equal(linhas[0].msg, 'Erro ao validar a sessão.');
    });

    it('responderErro devolve 500 com a mensagem do endpoint e registra a falha', () => {
        const { logger, linhas } = criarLoggerCapturado();
        const { res, registro } = respostaFalsa(logger.child({ reqId: 'req-5678' }));
        responderErro(res, new TypeError('x is undefined'), 'Erro ao buscar histórico.');

        assert.equal(registro.status, 500);
        assert.deepEqual(registro.corpo, { erro: 'Erro ao buscar histórico.' });
        assert.equal(linhas[0].reqId, 'req-5678');
        assert.match(String((linhas[0].err as { stack: string }).stack), /TypeError: x is undefined/);
    });

    it('um 4xx de regra do banco não é registrado como incidente', () => {
        const { logger, linhas } = criarLoggerCapturado();
        const { res, registro } = respostaFalsa(logger);
        responderErro(res, Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry 'x'" }), 'Erro.');
        assert.equal(registro.status, 409);
        assert.equal(linhas.length, 0);
    });

    it('o log do erro do MySQL não leva o SQL com valores nem a mensagem que repete o dado', () => {
        const { logger, linhas } = criarLoggerCapturado();
        const { res } = respostaFalsa(logger);
        const erro = Object.assign(new Error("Duplicate entry 'ana@exemplo.invalid' for key 'email'"), {
            code: 'ER_QUALQUER', errno: 1062, sqlState: '23000', sqlMessage: "Duplicate entry 'ana@exemplo.invalid'",
            sql: "INSERT INTO usuarios (email, senha) VALUES ('ana@exemplo.invalid', '$2b$10$hash')",
        });
        responderErro(res, erro, 'Erro ao criar.');
        const texto = JSON.stringify(linhas[0]);
        assert.ok(!texto.includes('ana@exemplo.invalid'));
        assert.ok(!texto.includes('$2b$'));
        assert.equal((linhas[0].err as { code: string }).code, 'ER_QUALQUER');
    });
});
