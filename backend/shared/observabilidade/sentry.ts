// Envio de falhas inesperadas ao Sentry. Sem SENTRY_DSN nada é carregado nem enviado: o SDK só entra
// na memória quando há para onde mandar.
import type * as SentryNode from '@sentry/node';

let sentry: typeof SentryNode | null = null;

// O global handler do SDK sairia do processo por conta própria; quem encerra a API é o server.ts.
const INTEGRACOES_DO_PROCESSO = new Set(['OnUncaughtException', 'OnUnhandledRejection']);

export const iniciarSentry = async (dsn: string | undefined, opcoes: Partial<SentryNode.NodeOptions> = {}): Promise<boolean> => {
    if (!dsn) return false;
    const modulo = await import('@sentry/node');
    modulo.init({
        dsn,
        tracesSampleRate: 0,
        // Só a falha e a pilha: nada de cookie, cabeçalho, corpo, query string, usuário nem valor de variável local.
        dataCollection: {
            userInfo: false,
            cookies: false,
            httpHeaders: false,
            httpBodies: [],
            urlQueryParams: false,
            databaseQueryData: false,
            stackFrameVariables: false,
        },
        integrations: (padrao) => padrao.filter((integracao) => !INTEGRACOES_DO_PROCESSO.has(integracao.name)),
        ...opcoes,
    });
    sentry = modulo;
    return true;
};

export const registrarNoSentry = (erro: unknown): void => {
    sentry?.captureException(erro);
};

// Antes de sair: o envio é assíncrono e o processo não pode morrer com o evento ainda na fila.
export const descarregarSentry = async (prazoMs = 2000): Promise<void> => {
    await sentry?.flush(prazoMs);
};
