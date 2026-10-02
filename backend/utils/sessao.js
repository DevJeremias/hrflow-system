const crypto = require('node:crypto');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const jwtSecret = require('../config/jwtSecret');

// Duração máxima de uma sessão (política SEC-06). Não há refresh token: depois disso, novo login.
const DURACAO_SESSAO_SEGUNDOS = 8 * 60 * 60;

// A sessão vive em dois cookies. O da sessão é HttpOnly: guarda o JWT e o JavaScript da página
// nunca o lê. O de CSRF é legível de propósito: o front-end o devolve no cabeçalho de cada
// requisição que muda estado, e sua presença também diz ao front-end que há sessão a confirmar.
const COOKIE_SESSAO = 'hrflow_sessao';
const COOKIE_CSRF = 'hrflow_csrf';
const CABECALHO_CSRF = 'x-csrf-token';

const HOSTS_LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

// O campo `sv` é a versão da sessão (usuarios.sessao_versao) no momento do login.
const emitirToken = (usuario, nome) => jwt.sign(
    {
        id: usuario.id,
        perfil: usuario.perfil,
        empresa_id: usuario.empresa_id,
        funcionario_id: usuario.funcionario_id || null,
        nome,
        sv: usuario.sessao_versao,
    },
    jwtSecret,
    { expiresIn: DURACAO_SESSAO_SEGUNDOS }
);

// Secure em HTTPS (req.secure respeita TRUST_PROXY, então vale atrás do Caddy) e, em produção,
// em qualquer host que não seja loopback: um proxy mal configurado não rebaixa o cookie.
const cookieSeguro = (req) =>
    req.secure || (process.env.NODE_ENV === 'production' && !HOSTS_LOOPBACK.has(req.hostname));

// O token CSRF é derivado do cookie de sessão com o segredo da API: um cookie injetado por
// um subdomínio ou por um XSS que só escreve cookies não consegue produzir um par válido.
const tokenCsrf = (tokenSessao) =>
    crypto.createHmac('sha256', jwtSecret).update(`csrf:${tokenSessao}`).digest('hex');

const atributosBase = (req) => ({ path: '/', sameSite: 'lax', secure: cookieSeguro(req) });

const iniciarSessao = (req, res, tokenSessao) => {
    const duracao = { maxAge: DURACAO_SESSAO_SEGUNDOS * 1000 };
    res.cookie(COOKIE_SESSAO, tokenSessao, { ...atributosBase(req), ...duracao, httpOnly: true });
    res.cookie(COOKIE_CSRF, tokenCsrf(tokenSessao), { ...atributosBase(req), ...duracao, httpOnly: false });
};

const encerrarSessao = (req, res) => {
    res.clearCookie(COOKIE_SESSAO, { ...atributosBase(req), httpOnly: true });
    res.clearCookie(COOKIE_CSRF, { ...atributosBase(req), httpOnly: false });
};

const lerTokenDaSessao = (req) => cookie.parse(req.headers.cookie || '')[COOKIE_SESSAO];

const csrfValido = (req, tokenSessao) => {
    const enviado = req.get(CABECALHO_CSRF);
    if (typeof enviado !== 'string') return false;
    const esperado = Buffer.from(tokenCsrf(tokenSessao));
    const recebido = Buffer.from(enviado);
    return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
};

module.exports = {
    DURACAO_SESSAO_SEGUNDOS, COOKIE_SESSAO, COOKIE_CSRF, CABECALHO_CSRF,
    emitirToken, iniciarSessao, encerrarSessao, lerTokenDaSessao, csrfValido, tokenCsrf, cookieSeguro,
};
