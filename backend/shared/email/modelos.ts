// Os e-mails que o HRFlow envia, em pt-BR: assunto, versão em texto e em HTML. O texto vem sempre de
// quem chama; aqui só se monta a moldura e se escapa o que vai para o HTML.
import type { Email } from './email.ts';

const escaparHtml = (texto: string): string => texto
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const moldura = (titulo: string, paragrafos: string[], botao?: { rotulo: string; link: string }, rodape?: string): string => `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td>
        <p style="margin:0 0 16px;font-size:14px;font-weight:bold;color:#4f46e5;">HRFlow</p>
        <h1 style="margin:0 0 16px;font-size:20px;">${escaparHtml(titulo)}</h1>
        ${paragrafos.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${escaparHtml(p)}</p>`).join('\n        ')}
        ${botao ? `<p style="margin:24px 0;"><a href="${escaparHtml(botao.link)}" style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block;">${escaparHtml(botao.rotulo)}</a></p>
        <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Se o botão não abrir, copie este endereço no navegador:<br>${escaparHtml(botao.link)}</p>` : ''}
        ${rodape ? `<p style="margin:16px 0 0;font-size:13px;color:#6b7280;">${escaparHtml(rodape)}</p>` : ''}
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;

interface Destinatario {
    nome: string;
    email: string;
}

const saudacao = (nome: string): string => {
    const primeiro = nome.trim().split(/\s+/)[0];
    return primeiro ? `Olá, ${primeiro}.` : 'Olá.';
};

export const VALIDADE_DA_REDEFINICAO_EM_MINUTOS = 60;

export const emailDeRedefinicaoDeSenha = (para: Destinatario, link: string): Email => {
    const paragrafos = [
        saudacao(para.nome),
        'Recebemos um pedido para redefinir a senha da sua conta no HRFlow. Use o botão abaixo para escolher uma nova senha.',
        `O link vale por ${VALIDADE_DA_REDEFINICAO_EM_MINUTOS} minutos e só pode ser usado uma vez.`,
    ];
    const rodape = 'Se você não fez esse pedido, ignore este e-mail: a sua senha continua a mesma.';
    return {
        para,
        assunto: 'Redefinição de senha do HRFlow',
        texto: [...paragrafos, `Redefinir a senha: ${link}`, rodape].join('\n\n'),
        html: moldura('Redefina a sua senha', paragrafos, { rotulo: 'Redefinir a senha', link }, rodape),
    };
};

export const emailDeNotificacao = (para: Destinatario, { titulo, mensagem, link }: { titulo: string; mensagem: string; link: string | null }): Email => {
    const paragrafos = [saudacao(para.nome), mensagem];
    return {
        para,
        assunto: titulo,
        texto: [...paragrafos, ...(link ? [`Abrir no HRFlow: ${link}`] : [])].join('\n\n'),
        html: moldura(titulo, paragrafos, link ? { rotulo: 'Abrir no HRFlow', link } : undefined),
    };
};
