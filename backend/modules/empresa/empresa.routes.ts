import express from 'express';
import * as empresaController from './empresa.controller.ts';
import { exigirPermissao } from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { dadosDaEmpresa } from './empresa.schemas.ts';

export const empresaRoutes = express.Router();

// O RH consulta (a folha depende desses dados); só o Administrador altera.
empresaRoutes.get('/', exigirPermissao('empresa:consultar'), empresaController.buscarEmpresa);
empresaRoutes.put('/', exigirPermissao('empresa:gerir'), validarEntrada({ body: dadosDaEmpresa }), empresaController.atualizarEmpresa);
