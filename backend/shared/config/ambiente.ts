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

// O e-mail transacional é opcional: sem EMAIL_TRANSPORT a API não envia e `email` é null.
export interface ConfigDeEmail {
    transporte: 'ses' | 'log';
    remetente: string;
    urlDoApp: string;
}

export interface Ambiente {
    porta: number;
    sentryDsn: string | undefined;
    email: ConfigDeEmail | null;
}

const PORTA_PADRAO = 3000;

const inteiroEntre = (valor: string, minimo: number, maximo: number): number | null => {
    const numero = /^\d+$/.test(valor) ? Number(valor) : NaN;
    return numero >= minimo && numero <= maximo ? numero : null;
};

const TRANSPORTES_DE_EMAIL = ['ses', 'log'] as const;

const lerEmail = (env: NodeJS.ProcessEnv, problemas: string[]): ConfigDeEmail | null => {
    const transporte = env.EMAIL_TRANSPORT?.trim();
    if (!transporte) return null;
    if (!(TRANSPORTES_DE_EMAIL as readonly string[]).includes(transporte)) {
        problemas.push(`EMAIL_TRANSPORT deve ser um destes: ${TRANSPORTES_DE_EMAIL.join(', ')} (ou ficar vazia, sem e-mail).`);
        return null;
    }
    // O transporte de log escreve o corpo do e-mail, que numa redefinição de senha é um token.
    if (transporte === 'log' && env.NODE_ENV === 'production') {
        problemas.push('EMAIL_TRANSPORT=log não é permitido em produção: o log guardaria os links de redefinição de senha.');
    }

    const remetente = env.EMAIL_FROM?.trim() ?? '';
    if (!/^(?:[^<>@]+<[^\s<>@]+@[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+)$/.test(remetente)) {
        problemas.push('EMAIL_FROM é obrigatória com EMAIL_TRANSPORT e deve ser um endereço de e-mail (ex.: HRFlow <nao-responder@exemplo.com.br>).');
    }

    const url = env.APP_URL?.trim().replace(/\/+$/, '') ?? '';
    if (!/^https?:\/\/[^\s/]+(:\d+)?$/.test(url)) {
        problemas.push('APP_URL é obrigatória com EMAIL_TRANSPORT e deve ser o endereço do front-end, sem caminho (ex.: https://hrflow.exemplo.com.br).');
    }
    return { transporte: transporte as ConfigDeEmail['transporte'], remetente, urlDoApp: url };
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

    // PORT=0 deixa o sistema escolher uma porta livre (os testes do server.ts usam).
    const textoDaPorta = env.PORT?.trim();
    const porta = textoDaPorta ? inteiroEntre(textoDaPorta, 0, 65535) : PORTA_PADRAO;
    if (porta === null) problemas.push('PORT deve ser um número de porta entre 0 e 65535.');

    const email = lerEmail(env, problemas);

    if (problemas.length > 0 || porta === null) throw new ErroDeAmbiente(problemas);
    return { porta, sentryDsn: env.SENTRY_DSN?.trim() || undefined, email };
};
