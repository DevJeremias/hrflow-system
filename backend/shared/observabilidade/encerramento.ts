// Encerramento ordenado: o deploy manda SIGTERM e o orquestrador mata o contêiner (SIGKILL) depois de
// 10 s. O servidor para de aceitar conexões, as requisições em andamento terminam e só então o pool
// fecha. O prazo é menor que o do orquestrador: o que não terminar até lá é cortado e o código de
// saída acusa.
import type http from 'node:http';
import type { Logger } from './logger.ts';

export const PRAZO_DE_ENCERRAMENTO_MS = 8000;

interface Opcoes {
    server: http.Server;
    pool: { end: () => Promise<void> };
    logger: Logger;
    prazoMs?: number;
    sair?: (codigo: number) => void;
    // Chamado antes de sair, para o que ainda está em fila (o envio ao Sentry, por exemplo).
    aoFinal?: () => Promise<void>;
}

// A função devolvida pode ser chamada várias vezes (dois SIGTERM, um sinal durante uma falha): só a primeira age.
export const criarEncerramento = ({ server, pool, logger, prazoMs = PRAZO_DE_ENCERRAMENTO_MS, sair = process.exit, aoFinal }: Opcoes) => {
    let emCurso: Promise<void> | null = null;

    return (motivo: string, codigo = 0): Promise<void> => {
        emCurso ??= (async () => {
            logger.info({ motivo }, 'encerrando: aguardando as requisições em andamento');
            const limite = setTimeout(() => {
                logger.error({ prazoMs }, 'encerrando: prazo esgotado, cortando as conexões que restam');
                server.closeAllConnections();
                sair(1);
            }, prazoMs);

            // Conexões keep-alive ociosas seguram o close() até o prazo; as ativas seguem até terminar e,
            // ao terminarem, ficam ociosas: por isso a varredura se repete até o servidor fechar.
            const varredura = setInterval(() => server.closeIdleConnections(), 100);
            try {
                const fechado = new Promise<void>((resolve) => server.close((erro) => {
                    if (erro) logger.warn({ err: erro }, 'encerrando: o servidor já estava fechado');
                    resolve();
                }));
                server.closeIdleConnections();
                await fechado;
                clearInterval(varredura);
                await pool.end();
                await aoFinal?.();
                logger.info('encerrado');
            } catch (erro) {
                logger.error({ err: erro }, 'encerrando: falha ao fechar os recursos');
                codigo = 1;
            } finally {
                clearInterval(varredura);
                clearTimeout(limite);
            }
            sair(codigo);
        })();
        return emCurso;
    };
};
