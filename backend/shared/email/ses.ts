// Transporte do Amazon SES. O SDK é carregado só na primeira entrega: quem não usa SES não paga o
// custo de carregá-lo. Credenciais e região vêm da cadeia padrão da AWS (AWS_REGION, perfil, papel).
import type { Email, TransporteDeEmail } from './email.ts';

export const criarTransporteSes = (): TransporteDeEmail => {
    const carregar = (() => {
        let carregado: Promise<{ ses: import('@aws-sdk/client-sesv2').SESv2Client; SendEmailCommand: typeof import('@aws-sdk/client-sesv2').SendEmailCommand }> | null = null;
        return () => {
            carregado ??= import('@aws-sdk/client-sesv2').then(({ SESv2Client, SendEmailCommand }) => ({ ses: new SESv2Client({}), SendEmailCommand }));
            return carregado;
        };
    })();

    return {
        enviar: async (email: Email, remetente: string) => {
            const { ses, SendEmailCommand } = await carregar();
            await ses.send(new SendEmailCommand({
                FromEmailAddress: remetente,
                Destination: { ToAddresses: [`${email.para.nome.replace(/[<>",;]/g, '')} <${email.para.email}>`] },
                Content: {
                    Simple: {
                        Subject: { Data: email.assunto, Charset: 'UTF-8' },
                        Body: {
                            Text: { Data: email.texto, Charset: 'UTF-8' },
                            Html: { Data: email.html, Charset: 'UTF-8' },
                        },
                    },
                },
            }));
        },
    };
};
