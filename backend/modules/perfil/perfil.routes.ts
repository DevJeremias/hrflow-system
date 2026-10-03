import express from 'express';
import * as perfilController from './perfil.controller.ts';
import verificarPerfil from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { criarLimitadores } from '../../shared/middlewares/limitesAuth.ts';
import { atualizarMeusDados, alterarSenha } from './perfil.schemas.ts';

const limitadores = criarLimitadores();

export const perfilRoutes = express.Router();

perfilRoutes.use(verificarPerfil(['Administrador', 'RH', 'Colaborador']));

perfilRoutes.get('/meus-dados', perfilController.obterMeuPerfil);
perfilRoutes.get('/avatar', perfilController.obterMeuAvatar);
perfilRoutes.put('/meus-dados', validarEntrada({ body: atualizarMeusDados }), perfilController.atualizarMeusDados);
perfilRoutes.put('/alterar-senha',
    validarEntrada({ body: alterarSenha }), limitadores.alterarSenhaPorUsuario,
    perfilController.alterarMinhaSenha);
