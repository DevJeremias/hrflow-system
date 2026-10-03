import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import * as authController from './auth.controller.ts';
import { validarLogin, validarRegistro } from './auth.schemas.ts';
import type { Validacao } from './auth.schemas.ts';
import authMiddleware from '../../shared/middlewares/authMiddleware.js';
import { corpoJson, criarLimitadores, tratarErroDeCorpo } from '../../shared/middlewares/limitesAuth.js';

// Ordem em cada rota: limite por IP (barato, antes de ler o corpo), corpo pequeno,
// validação de entrada, limite por identidade e só então o controller.
const validar = <T>(validador: (corpo: unknown) => Validacao<T>) => (req: Request, res: Response, next: NextFunction) => {
    const { erro, dados } = validador(req.body);
    if (erro) return res.status(400).json({ erro });
    req.dadosValidados = { body: dados };
    next();
};

// Os limites são parâmetro para os testes apertarem só o que querem exercitar.
export const criarRouter = (limites?: Parameters<typeof criarLimitadores>[0]) => {
    const router = express.Router();
    const limitadores = criarLimitadores(limites);

    router.post('/registrar',
        limitadores.registroPorIp, corpoJson, validar(validarRegistro), limitadores.registroPorIdentidade,
        authController.registrarConta);
    router.post('/login',
        limitadores.loginPorIp, corpoJson, validar(validarLogin), limitadores.loginPorIdentidade,
        authController.login);

    router.post('/logout', authController.logout);

    router.get('/sessao', authMiddleware, authController.sessao);

    router.use(tratarErroDeCorpo);
    return router;
};

export const authRoutes = criarRouter();
