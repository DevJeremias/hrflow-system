// A sessão: o JWT, os dois cookies que o carregam e o token CSRF. Não consulta o banco; quem
// confere se a sessão ainda vale a cada requisição é middlewares/authMiddleware.js.
import crypto from 'node:crypto';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import type { Request, Response, CookieOptions } from 'express';
import segredoJwt from '../../shared/config/jwtSecret.js';

// config/jwtSecret.js recusa a ausência do segredo ao ser carregado, mas o tipo inferido do
// JavaScript ainda inclui undefined.
const jwtSecret = segredoJwt as string;

// Duração máxima de uma sessão (política SEC-06). Não há refresh token: depois disso, novo login.
export const DURACAO_SESSAO_SEGUNDOS = 8 * 60 * 60;

// A sessão vive em dois cookies. O da sessão é HttpOnly: guarda o JWT e o JavaScript da página
// nunca o lê. O de CSRF é legível de propósito: o front-end o devolve no cabeçalho de cada
// requisição que muda estado, e sua presença também diz ao front-end que há sessão a confirmar.
export const COOKIE_SESSAO = 'hrflow_sessao';
export const COOKIE_CSRF = 'hrflow_csrf';
export const CABECALHO_CSRF = 'x-csrf-token';

const HOSTS_LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

// O que o token precisa de uma linha de usuarios. `sessao_versao` é a versão da sessão no momento
// do login.
export interface UsuarioDoToken {
    id: number;
    perfil: string;
    empresa_id: number;
    funcionario_id: number | null;
    sessao_versao: number;
}

export const emitirToken = (usuario: UsuarioDoToken, nome: string): string => jwt.sign(
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
export const cookieSeguro = (req: Request): boolean =>
    req.secure || (process.env.NODE_ENV === 'production' && !HOSTS_LOOPBACK.has(req.hostname));

// O token CSRF é derivado do cookie de sessão com o segredo da API: um cookie injetado por
// um subdomínio ou por um XSS que só escreve cookies não consegue produzir um par válido.
export const tokenCsrf = (tokenSessao: string): string =>
    crypto.createHmac('sha256', jwtSecret).update(`csrf:${tokenSessao}`).digest('hex');

const atributosBase = (req: Request): CookieOptions => ({ path: '/', sameSite: 'lax', secure: cookieSeguro(req) });

export const iniciarSessao = (req: Request, res: Response, tokenSessao: string): void => {
    const duracao = { maxAge: DURACAO_SESSAO_SEGUNDOS * 1000 };
    res.cookie(COOKIE_SESSAO, tokenSessao, { ...atributosBase(req), ...duracao, httpOnly: true });
    res.cookie(COOKIE_CSRF, tokenCsrf(tokenSessao), { ...atributosBase(req), ...duracao, httpOnly: false });
};

export const encerrarSessao = (req: Request, res: Response): void => {
    res.clearCookie(COOKIE_SESSAO, { ...atributosBase(req), httpOnly: true });
    res.clearCookie(COOKIE_CSRF, { ...atributosBase(req), httpOnly: false });
};

export const lerTokenDaSessao = (req: Request): string | undefined => parse(req.headers.cookie || '')[COOKIE_SESSAO];

export const csrfValido = (req: Request, tokenSessao: string): boolean => {
    const enviado = req.get(CABECALHO_CSRF);
    if (typeof enviado !== 'string') return false;
    const esperado = Buffer.from(tokenCsrf(tokenSessao));
    const recebido = Buffer.from(enviado);
    return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
};
