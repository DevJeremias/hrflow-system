// E-mail transacional, opcional: sem EMAIL_TRANSPORT a API não envia nada e os fluxos que dependem
// dele (notificações por e-mail, "esqueci a senha") seguem pelo que já têm. O transporte (SES em
// produção, o log em desenvolvimento) é escolhido na partida (server.ts) e trocado pelos testes.
import logger from '../observabilidade/logger.ts';

export interface Email {
    para: { nome: string; email: string };
    assunto: string;
    texto: string;
    html: string;
}

export interface TransporteDeEmail {
    enviar: (email: Email, remetente: string) => Promise<void>;
}

export interface ConfiguracaoDeEmail {
    transporte: TransporteDeEmail;
    // "HRFlow <nao-responder@exemplo.com.br>"; no SES o domínio precisa estar verificado.
    remetente: string;
    // Endereço público do front-end, sem barra no fim: os links dos e-mails partem dele.
    urlDoApp: string;
}

let configuracao: ConfiguracaoDeEmail | null = null;

export const configurarEmail = (nova: ConfiguracaoDeEmail | null): void => {
    configuracao = nova;
};

export const emailConfigurado = (): boolean => configuracao !== null;

// Link absoluto para um caminho do front-end ('/redefinir-senha?token=...').
export const linkDoApp = (caminho: string): string => {
    if (!configuracao) throw new Error('linkDoApp exige o e-mail configurado (APP_URL).');
    return `${configuracao.urlDoApp}${caminho}`;
};

// Entrega o e-mail pelo transporte configurado; sem configuração devolve false e nada acontece.
export const enviarEmail = async (email: Email): Promise<boolean> => {
    if (!configuracao) return false;
    await configuracao.transporte.enviar(email, configuracao.remetente);
    return true;
};

// Os e-mails de aviso são complemento da notificação na tela: a falha de um não derruba a operação que
// o motivou (fechar a folha, decidir a justificativa), só entra no log.
export const enviarEmailSemFalhar = async (email: Email): Promise<void> => {
    try {
        await enviarEmail(email);
    } catch (erro) {
        logger.error({ err: erro }, 'Falha ao enviar o e-mail transacional');
    }
};

// Desenvolvimento: o e-mail aparece no log em vez de sair. Recusado em produção (ambiente.ts), porque
// o corpo de uma redefinição de senha carrega um token.
export const transporteDeLog: TransporteDeEmail = {
    enviar: async (email) => {
        logger.info({ para: email.para.email, assunto: email.assunto, texto: email.texto }, 'E-mail (transporte de log, não enviado)');
    },
};
