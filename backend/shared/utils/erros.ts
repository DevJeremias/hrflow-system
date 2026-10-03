// Tradução de falhas do MySQL e do pool para respostas 4xx/503 com mensagem acionável.
// O que não se reconhece continua sendo 500, registrado no log e sem detalhe para o cliente.

import type { Response } from 'express';
import logger from '../observabilidade/logger.ts';
import { registrarNoSentry } from '../observabilidade/sentry.ts';

// O que o mysql2 e o pool entregam em um erro; só o que a tradução lê.
interface ErroDoBanco {
    code?: string;
    message?: string;
    sqlMessage?: string;
}

interface Traducao {
    status: number;
    erro: string;
    detalhes?: { campo: string; mensagem: string }[];
    retryAfter?: number;
}

const COLUNA = /column '([^']+)'/i;

const rotuloDaColuna = (error: ErroDoBanco) => {
    const coluna = COLUNA.exec(error.sqlMessage || error.message || '')?.[1];
    return coluna ? ` (campo ${coluna})` : '';
};

const VALOR_INVALIDO = (error: ErroDoBanco): Traducao => ({
    status: 400,
    erro: `Algum valor informado é inválido ou excede o limite permitido${rotuloDaColuna(error)}.`,
});

export const EMAIL_DUPLICADO = 'Este e-mail já está registado no sistema.';

const BANCO_INDISPONIVEL = (): Traducao => ({
    status: 503,
    erro: 'O banco de dados está indisponível. Tente novamente em instantes.',
    retryAfter: 5,
});

const TRADUCOES: Record<string, (error: ErroDoBanco) => Traducao> = {
    ER_DUP_ENTRY: (error) => (/email/i.test(error.sqlMessage || '')
        ? { status: 409, erro: EMAIL_DUPLICADO, detalhes: [{ campo: 'email', mensagem: EMAIL_DUPLICADO }] }
        : { status: 409, erro: 'Já existe um registro com estes dados.' }),
    ER_DATA_TOO_LONG: VALOR_INVALIDO,
    ER_TRUNCATED_WRONG_VALUE: VALOR_INVALIDO,
    ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: VALOR_INVALIDO,
    ER_WRONG_VALUE_FOR_TYPE: VALOR_INVALIDO,
    ER_WARN_DATA_OUT_OF_RANGE: VALOR_INVALIDO,
    ER_DATA_OUT_OF_RANGE: VALOR_INVALIDO,
    WARN_DATA_TRUNCATED: VALOR_INVALIDO,
    ER_BAD_NULL_ERROR: (error) => ({ status: 400, erro: `Campo obrigatório não informado${rotuloDaColuna(error)}.` }),
    ER_NO_REFERENCED_ROW_2: () => ({ status: 400, erro: 'O cargo ou departamento informado não existe.' }),
    ER_ROW_IS_REFERENCED_2: () => ({ status: 409, erro: 'Não é possível remover: existem registros vinculados a este item.' }),
    ER_QUERY_TIMEOUT: () => ({ status: 503, erro: 'A consulta demorou mais que o permitido. Tente novamente em instantes.' }),
    // Banco fora do ar, conexão perdida no meio da consulta ou sem vaga: o usuário só precisa tentar de novo.
    ECONNREFUSED: BANCO_INDISPONIVEL,
    ETIMEDOUT: BANCO_INDISPONIVEL,
    PROTOCOL_CONNECTION_LOST: BANCO_INDISPONIVEL,
    ER_CON_COUNT_ERROR: BANCO_INDISPONIVEL,
    ECONNRESET: BANCO_INDISPONIVEL,
    EHOSTUNREACH: BANCO_INDISPONIVEL,
    ENOTFOUND: BANCO_INDISPONIVEL,
    EAI_AGAIN: BANCO_INDISPONIVEL,
};

// O mysql2 sinaliza fila cheia só pela mensagem, sem código.
const FILA_CHEIA = 'Queue limit reached.';

export const traduzirErro = (error: unknown): Traducao | null => {
    const erroDoBanco = error as ErroDoBanco | null | undefined;
    if (erroDoBanco?.message === FILA_CHEIA) {
        return { status: 503, erro: 'O servidor está ocupado. Tente novamente em instantes.', retryAfter: 5 };
    }
    return (erroDoBanco?.code ? TRADUCOES[erroDoBanco.code]?.(erroDoBanco) : undefined) ?? null;
};

// Usada pelos controllers no catch: devolve o 4xx/503 conhecido ou o 500 com a mensagem do endpoint.
// O que o cliente vê como 5xx é incidente: vai ao log, com o reqId da requisição, e ao Sentry.
export const responderErro = (res: Response, error: unknown, mensagem500: string) => {
    const traduzido = traduzirErro(error);
    if (!traduzido || traduzido.status >= 500) {
        (res.req?.log ?? logger).error({ err: error }, mensagem500);
        registrarNoSentry(error);
    }
    if (traduzido) {
        if (traduzido.retryAfter) res.set('Retry-After', String(traduzido.retryAfter));
        return res.status(traduzido.status).json({ erro: traduzido.erro, ...(traduzido.detalhes && { detalhes: traduzido.detalhes }) });
    }
    return res.status(500).json({ erro: mensagem500 });
};
