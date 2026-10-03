import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Options } from 'express-rate-limit';

const MINUTO = 60 * 1000;

// O corpo de login e cadastro cabe em poucas centenas de bytes: o limite global de
// 10mb existe para as imagens base64 de outras rotas e não deve valer aqui.
export const LIMITE_CORPO = '4kb';

export const LIMITES_PADRAO = {
    loginPorIp: { windowMs: 15 * MINUTO, limit: 30 },
    loginPorIdentidade: { windowMs: 15 * MINUTO, limit: 10 },
    registroPorIp: { windowMs: 60 * MINUTO, limit: 5 },
    registroPorIdentidade: { windowMs: 60 * MINUTO, limit: 3 },
    alterarSenhaPorUsuario: { windowMs: 15 * MINUTO, limit: 5 },
    esqueciSenhaPorIp: { windowMs: 60 * MINUTO, limit: 10 },
    esqueciSenhaPorIdentidade: { windowMs: 60 * MINUTO, limit: 3 },
    redefinirSenhaPorIp: { windowMs: 15 * MINUTO, limit: 20 },
};

export const corpoJson = express.json({ limit: LIMITE_CORPO });

const emailDoCorpo = (req: Request): string => {
    const email = req.body?.email;
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

type Limite = Pick<Options, 'windowMs' | 'limit'>;

const criarLimitador = (opcoes: Limite, extra: Partial<Options> = {}) => rateLimit({
    ...opcoes,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        const segundos = Math.ceil(opcoes.windowMs / 1000);
        res.status(429).json({
            erro: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
            retryAfterSegundos: Number(res.getHeader('Retry-After')) || segundos,
        });
    },
    ...extra,
});

// Cada chamada devolve limitadores novos, com contadores próprios (em memória, por processo).
export const criarLimitadores = (limites: Partial<typeof LIMITES_PADRAO> = {}) => {
    const config = { ...LIMITES_PADRAO, ...limites };
    return {
        // Só falhas contam: um escritório inteiro atrás do mesmo IP entra no início do expediente
        // sem esgotar a cota, e quem tenta adivinhar senhas continua limitado.
        loginPorIp: criarLimitador(config.loginPorIp, { skipSuccessfulRequests: true }),
        // Só falhas contam: quem acerta a senha não esgota a própria cota.
        loginPorIdentidade: criarLimitador(config.loginPorIdentidade, {
            keyGenerator: emailDoCorpo,
            skipSuccessfulRequests: true,
        }),
        registroPorIp: criarLimitador(config.registroPorIp),
        registroPorIdentidade: criarLimitador(config.registroPorIdentidade, { keyGenerator: emailDoCorpo }),
        // Cada pedido manda um e-mail: sem teto, a rota serviria para encher a caixa de alguém. Conta todos
        // os pedidos, não só as falhas, e por e-mail para o teto valer mesmo vindo de IPs diferentes.
        esqueciSenhaPorIp: criarLimitador(config.esqueciSenhaPorIp),
        esqueciSenhaPorIdentidade: criarLimitador(config.esqueciSenhaPorIdentidade, { keyGenerator: emailDoCorpo }),
        // O token tem 256 bits e não se adivinha; o teto só barra quem martela a rota.
        redefinirSenhaPorIp: criarLimitador(config.redefinirSenhaPorIp),
        // A troca de senha confere a senha atual: sem teto, quem tem uma sessão (ou um computador
        // deixado aberto) a descobriria por tentativa. Conta por usuário, só as falhas.
        alterarSenhaPorUsuario: criarLimitador(config.alterarSenhaPorUsuario, {
            keyGenerator: (req: Request) => {
                if (!req.usuario) throw new Error('req.usuario ausente: a rota precisa do authMiddleware.');
                return String(req.usuario.id);
            },
            skipSuccessfulRequests: true,
        }),
    };
};

// Erros do parser de corpo viram JSON em pt-BR, em vez da página HTML padrão do Express.
export const tratarErroDeCorpo = (err: { type?: string }, req: Request, res: Response, next: NextFunction) => {
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ erro: `O corpo da requisição excede o limite de ${LIMITE_CORPO}.` });
    }
    if (err.type === 'entity.parse.failed' || err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') {
        return res.status(400).json({ erro: 'Corpo da requisição inválido. Envie um JSON válido.' });
    }
    next(err);
};
