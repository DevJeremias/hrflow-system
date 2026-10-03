// Logger único da API: uma linha JSON por evento em stdout, que o Docker e o Caddy recolhem do mesmo
// jeito. O nível vem de LOG_LEVEL (padrão info; os testes usam silent).
import pino from 'pino';
import type { DestinationStream, Logger } from 'pino';

export type { Logger };

const FRAME = /^\s+at /;

// Erro do mysql2 carrega o SQL com os valores já interpolados e uma mensagem que repete o dado
// ("Duplicate entry 'ana@exemplo.com'"): fica só o código, o errno e as linhas da pilha.
export const serializarErro = (erro: unknown) => {
    if (!(erro instanceof Error)) return { mensagem: String(erro) };
    const { code, errno, sqlState, sqlMessage, sql } = erro as Error & Record<string, unknown>;
    const doBanco = sqlMessage !== undefined || sql !== undefined;
    return {
        tipo: erro.name,
        code,
        ...(doBanco && { errno, sqlState }),
        ...(!doBanco && { mensagem: erro.message }),
        stack: doBanco ? erro.stack?.split('\n').filter((linha) => FRAME.test(linha)).join('\n') : erro.stack,
    };
};

export const criarLogger = (destino?: DestinationStream, nivel: string | undefined = process.env.LOG_LEVEL): Logger =>
    pino({
        level: nivel?.trim() || 'info',
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: { level: (rotulo) => ({ nivel: rotulo }) },
        serializers: { err: serializarErro },
    }, destino);

const logger = criarLogger();
export default logger;
