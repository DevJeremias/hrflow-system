import express from 'express';
import * as perfilController from './perfil.controller.ts';
import verificarPerfil from '../../shared/middlewares/roleMiddleware.js';
import validarEntrada from '../../shared/middlewares/validarEntrada.js';
import { criarLimitadores } from '../../shared/middlewares/limitesAuth.js';
import { atualizarMeusDados, alterarSenha } from './perfil.schemas.ts';

const limitadores = criarLimitadores();

export const perfilRoutes = express.Router();

perfilRoutes.use(verificarPerfil(['Administrador', 'RH', 'Colaborador']));

perfilRoutes.get('/meus-dados', perfilController.obterMeuPerfil);
perfilRoutes.put('/meus-dados', validarEntrada({ body: atualizarMeusDados }), perfilController.atualizarMeusDados);
perfilRoutes.put('/alterar-senha',
    validarEntrada({ body: alterarSenha }), limitadores.alterarSenhaPorUsuario,
    perfilController.alterarMinhaSenha);
