// Confere as variáveis de ambiente que a API precisa para subir e as devolve já convertidas. Roda na
// partida (server.ts): configuração errada derruba o processo com a lista do que falta, em vez de
// aparecer como 500 na primeira requisição que toca o banco. O segredo JWT tem a conferência própria
// em jwtSecret.ts.

export class ErroDeAmbiente extends Error {
    readonly problemas: string[];

    constructor(problemas: string[]) {
        super(`Configuração de ambiente inválida:\n- ${problemas.join('\n- ')}`);
        this.name = 'ErroDeAmbiente';
        this.problemas = problemas;
    }
}

export interface Ambiente {
    porta: number;
    sentryDsn: string | undefined;
}

const PORTA_PADRAO = 3000;

const inteiroEntre = (valor: string, minimo: number, maximo: number): number | null => {
    const numero = /^\d+$/.test(valor) ? Number(valor) : NaN;
    return numero >= minimo && numero <= maximo ? numero : null;
};

export const lerAmbiente = (env: NodeJS.ProcessEnv = process.env): Ambiente => {
    const problemas: string[] = [];

    for (const nome of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
        if (!env[nome]?.trim()) problemas.push(`${nome} é obrigatória e não pode estar vazia.`);
    }

    const portaDoBanco = env.DB_PORT?.trim();
    if (portaDoBanco && inteiroEntre(portaDoBanco, 1, 65535) === null) {
        problemas.push('DB_PORT deve ser um número de porta entre 1 e 65535.');
    }

    for (const nome of ['DB_CONNECTION_LIMIT', 'DB_QUEUE_LIMIT']) {
        const valor = env[nome]?.trim();
        if (valor && inteiroEntre(valor, 1, 10000) === null) problemas.push(`${nome} deve ser um inteiro positivo.`);
    }

    const textoDaPorta = env.PORT?.trim();
    const porta = textoDaPorta ? inteiroEntre(textoDaPorta, 1, 65535) : PORTA_PADRAO;
    if (porta === null) problemas.push('PORT deve ser um número de porta entre 1 e 65535.');

    if (problemas.length > 0 || porta === null) throw new ErroDeAmbiente(problemas);
    return { porta, sentryDsn: env.SENTRY_DSN?.trim() || undefined };
};
