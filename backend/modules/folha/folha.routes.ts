import express from 'express';
import * as folhaController from './folha.controller.ts';
import verificarPerfil from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { consultarFolha } from './folha.schemas.ts';

export const folhaRoutes = express.Router();

// Rota geral: apenas Administrador e RH.
folhaRoutes.get('/processar', verificarPerfil(['Administrador', 'RH']), validarEntrada({ query: consultarFolha }), folhaController.processarFolha);

// Rota individual: qualquer pessoa logada vê o SEU próprio holerite.
folhaRoutes.get('/meu-holerite', folhaController.meuHolerite);
