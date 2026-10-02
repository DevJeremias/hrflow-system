// Tradução de falhas do MySQL e do pool para respostas 4xx/503 com mensagem acionável.
// O que não se reconhece continua sendo 500, registrado no log e sem detalhe para o cliente.

const COLUNA = /column '([^']+)'/i;

const rotuloDaColuna = (error) => {
    const coluna = COLUNA.exec(error.sqlMessage || error.message || '')?.[1];
    return coluna ? ` (campo ${coluna})` : '';
};

const VALOR_INVALIDO = (error) => ({
    status: 400,
    erro: `Algum valor informado é inválido ou excede o limite permitido${rotuloDaColuna(error)}.`,
});

const TRADUCOES = {
    ER_DUP_ENTRY: (error) => ({
        status: 409,
        erro: /email/i.test(error.sqlMessage || '') ? 'Este e-mail já está registado no sistema.' : 'Já existe um registro com estes dados.',
    }),
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
};

// O mysql2 sinaliza fila cheia só pela mensagem, sem código.
const FILA_CHEIA = 'Queue limit reached.';

const traduzirErro = (error) => {
    if (error?.message === FILA_CHEIA) {
        return { status: 503, erro: 'O servidor está ocupado. Tente novamente em instantes.', retryAfter: 5 };
    }
    return TRADUCOES[error?.code]?.(error) ?? null;
};

// Usada pelos controllers no catch: devolve o 4xx/503 conhecido ou o 500 com a mensagem do endpoint.
const responderErro = (res, error, mensagem500) => {
    const traduzido = traduzirErro(error);
    if (traduzido) {
        if (traduzido.retryAfter) res.set('Retry-After', String(traduzido.retryAfter));
        return res.status(traduzido.status).json({ erro: traduzido.erro });
    }
    console.error(`${mensagem500}:`, error);
    return res.status(500).json({ erro: mensagem500 });
};

module.exports = { traduzirErro, responderErro };
