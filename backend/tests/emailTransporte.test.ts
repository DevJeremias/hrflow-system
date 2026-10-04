// Os transportes de e-mail e os modelos em pt-BR, sem banco: o SES é exercitado de verdade, com o SDK da AWS
// apontado para um servidor local que guarda o pedido (AWS_ENDPOINT_URL), e o transporte de log só escreve.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import './support/logSilencioso.ts';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { configurarEmail, emailConfigurado, enviarEmail, enviarEmailSemFalhar, linkDoApp, transporteDeLog } from '../shared/email/email.ts';
import type { Email } from '../shared/email/email.ts';
import { criarTransporteSes } from '../shared/email/ses.ts';
import { emailDeNotificacao, emailDeRedefinicaoDeSenha } from '../shared/email/modelos.ts';

const email: Email = {
    para: { nome: 'Ana "Açaí" <Silva>', email: 'ana@exemplo.invalid' },
    assunto: 'Redefinição de senha do HRFlow',
    texto: 'Olá, Ana.\n\nUse o link.',
    html: '<p>Olá, Ana.</p>',
};

describe('transporte do SES', () => {
    let servidor: http.Server;
    const pedidos: { metodo?: string; url?: string; corpo: Record<string, unknown> }[] = [];
    let status = 200;
    const ambienteAnterior = { ...process.env };

    before(async () => {
        servidor = http.createServer((req, res) => {
            const partes: Buffer[] = [];
            req.on('data', (parte: Buffer) => partes.push(parte));
            req.on('end', () => {
                pedidos.push({ metodo: req.method, url: req.url, corpo: JSON.parse(Buffer.concat(partes).toString('utf8') || '{}') });
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(status === 200 ? JSON.stringify({ MessageId: 'id-ficticio' }) : JSON.stringify({ message: 'Email address is not verified.' }));
            });
        });
        await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
        Object.assign(process.env, {
            AWS_ENDPOINT_URL: `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`,
            AWS_REGION: 'us-east-2',
            AWS_ACCESS_KEY_ID: 'chave-ficticia',
            AWS_SECRET_ACCESS_KEY: 'segredo-ficticio',
        });
    });

    after(async () => {
        await new Promise((resolve) => servidor.close(resolve));
        for (const chave of ['AWS_ENDPOINT_URL', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) {
            if (ambienteAnterior[chave] === undefined) delete process.env[chave];
            else process.env[chave] = ambienteAnterior[chave];
        }
    });

    it('manda o e-mail em UTF-8, com o texto e o HTML, o remetente e o destinatário sem caracteres de cabeçalho', async () => {
        await criarTransporteSes().enviar(email, 'HRFlow <nao-responder@exemplo.invalid>');
        assert.equal(pedidos.length, 1);
        assert.equal(pedidos[0].metodo, 'POST');
        assert.equal(pedidos[0].url, '/v2/email/outbound-emails');
        assert.deepEqual(pedidos[0].corpo, {
            FromEmailAddress: 'HRFlow <nao-responder@exemplo.invalid>',
            Destination: { ToAddresses: ['Ana Açaí Silva <ana@exemplo.invalid>'] },
            Content: { Simple: {
                Subject: { Data: 'Redefinição de senha do HRFlow', Charset: 'UTF-8' },
                Body: { Text: { Data: 'Olá, Ana.\n\nUse o link.', Charset: 'UTF-8' }, Html: { Data: '<p>Olá, Ana.</p>', Charset: 'UTF-8' } },
            } },
        });
    });

    it('a falha do SES sobe como erro, e enviarEmailSemFalhar a engole para não desfazer a operação', async () => {
        const transporte = criarTransporteSes();
        status = 400;
        await assert.rejects(transporte.enviar(email, 'nao-responder@exemplo.invalid'));
        configurarEmail({ transporte, remetente: 'nao-responder@exemplo.invalid', urlDoApp: 'https://hrflow.exemplo.invalid' });
        try {
            await assert.doesNotReject(enviarEmailSemFalhar(email));
        } finally {
            configurarEmail(null);
            status = 200;
        }
    });
});

describe('configuração do e-mail', () => {
    it('sem configuração nada é enviado e o link do app não existe', async () => {
        configurarEmail(null);
        assert.equal(emailConfigurado(), false);
        assert.equal(await enviarEmail(email), false);
        assert.throws(() => linkDoApp('/redefinir-senha'), /APP_URL/);
    });

    it('configurado, entrega pelo transporte e monta links a partir do endereço do app', async () => {
        const enviados: [Email, string][] = [];
        configurarEmail({ transporte: { enviar: async (e, remetente) => { enviados.push([e, remetente]); } }, remetente: 'nao-responder@exemplo.invalid', urlDoApp: 'https://hrflow.exemplo.invalid' });
        try {
            assert.equal(await enviarEmail(email), true);
            assert.deepEqual(enviados.map(([, remetente]) => remetente), ['nao-responder@exemplo.invalid']);
            assert.equal(linkDoApp('/meu-painel/holerites'), 'https://hrflow.exemplo.invalid/meu-painel/holerites');
        } finally {
            configurarEmail(null);
        }
    });

    it('o transporte de log não envia nada e não falha', async () => {
        await assert.doesNotReject(transporteDeLog.enviar(email, 'nao-responder@exemplo.invalid'));
    });
});

describe('modelos em pt-BR', () => {
    it('a redefinição de senha cumprimenta pelo primeiro nome, traz o link e a validade de 60 minutos', () => {
        const modelo = emailDeRedefinicaoDeSenha({ nome: 'Ana Beatriz Silva', email: 'ana@exemplo.invalid' }, 'https://hrflow.exemplo.invalid/redefinir-senha#token=abc');
        assert.equal(modelo.assunto, 'Redefinição de senha do HRFlow');
        assert.match(modelo.texto, /^Olá, Ana\./);
        assert.match(modelo.texto, /60 minutos e só pode ser usado uma vez/);
        assert.match(modelo.texto, /Redefinir a senha: https:\/\/hrflow\.exemplo\.invalid\/redefinir-senha#token=abc/);
        assert.match(modelo.texto, /ignore este e-mail/);
        assert.match(modelo.html, /<html lang="pt-BR">/);
    });

    it('a notificação sem link não traz botão, e o que vai ao HTML é escapado', () => {
        const modelo = emailDeNotificacao({ nome: '   ', email: 'a@exemplo.invalid' }, { titulo: 'Holerite <b>novo</b>', mensagem: 'Veja "isto" & aquilo.', link: null });
        assert.match(modelo.texto, /^Olá\./);
        assert.doesNotMatch(modelo.texto, /Abrir no HRFlow/);
        assert.doesNotMatch(modelo.html, /<a href/);
        assert.match(modelo.html, /Holerite &lt;b&gt;novo&lt;\/b&gt;/);
        assert.match(modelo.html, /Veja &quot;isto&quot; &amp; aquilo\./);
        const comLink = emailDeNotificacao({ nome: 'Caio', email: 'c@exemplo.invalid' }, { titulo: 'x', mensagem: 'y', link: 'https://hrflow.exemplo.invalid/a?b=1&c=2' });
        assert.match(comLink.html, /href="https:\/\/hrflow\.exemplo\.invalid\/a\?b=1&amp;c=2"/);
    });
});
