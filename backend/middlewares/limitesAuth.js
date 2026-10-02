const express = require('express');
const { rateLimit } = require('express-rate-limit');

const MINUTO = 60 * 1000;

// O corpo de login e cadastro cabe em poucas centenas de bytes: o limite global de
// 10mb existe para as imagens base64 de outras rotas e não deve valer aqui.
const LIMITE_CORPO = '4kb';

const LIMITES_PADRAO = {
    loginPorIp: { windowMs: 15 * MINUTO, limit: 30 },
    loginPorIdentidade: { windowMs: 15 * MINUTO, limit: 10 },
    registroPorIp: { windowMs: 60 * MINUTO, limit: 5 },
    registroPorIdentidade: { windowMs: 60 * MINUTO, limit: 3 },
};

const corpoJson = express.json({ limit: LIMITE_CORPO });

const emailDoCorpo = (req) => {
    const email = req.body?.email;
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

const criarLimitador = (opcoes, extra = {}) => rateLimit({
    ...opcoes,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
        const segundos = Math.ceil(opcoes.windowMs / 1000);
        res.status(429).json({
            erro: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
            retryAfterSegundos: Number(res.getHeader('Retry-After')) || segundos,
        });
    },
    ...extra,
});

// Cada chamada devolve limitadores novos, com contadores próprios (em memória, por processo).
const criarLimitadores = (limites = {}) => {
    const config = { ...LIMITES_PADRAO, ...limites };
    return {
        loginPorIp: criarLimitador(config.loginPorIp),
        // Só falhas contam: quem acerta a senha não esgota a própria cota.
        loginPorIdentidade: criarLimitador(config.loginPorIdentidade, {
            keyGenerator: emailDoCorpo,
            skipSuccessfulRequests: true,
        }),
        registroPorIp: criarLimitador(config.registroPorIp),
        registroPorIdentidade: criarLimitador(config.registroPorIdentidade, { keyGenerator: emailDoCorpo }),
    };
};

// Erros do parser de corpo viram JSON em pt-BR, em vez da página HTML padrão do Express.
const tratarErroDeCorpo = (err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ erro: `O corpo da requisição excede o limite de ${LIMITE_CORPO}.` });
    }
    if (err.type === 'entity.parse.failed' || err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') {
        return res.status(400).json({ erro: 'Corpo da requisição inválido. Envie um JSON válido.' });
    }
    next(err);
};

module.exports = { LIMITE_CORPO, LIMITES_PADRAO, corpoJson, criarLimitadores, tratarErroDeCorpo };
