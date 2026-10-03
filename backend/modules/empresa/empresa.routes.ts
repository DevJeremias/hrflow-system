import express from 'express';
import * as empresaController from './empresa.controller.ts';
import verificarPerfil from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { dadosDaEmpresa } from './empresa.schemas.ts';

export const empresaRoutes = express.Router();

// O RH consulta (a folha depende desses dados); só o Administrador altera.
empresaRoutes.get('/', verificarPerfil(['Administrador', 'RH']), empresaController.buscarEmpresa);
empresaRoutes.put('/', verificarPerfil(['Administrador']), validarEntrada({ body: dadosDaEmpresa }), empresaController.atualizarEmpresa);
