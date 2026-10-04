import express from 'express';
import * as relatoriosController from './relatorios.controller.ts';
import { exigirPermissao } from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { consultarAbsenteismo, consultarAniversariantes, consultarCusto, consultarHeadcount } from './relatorios.schemas.ts';

export const relatoriosRoutes = express.Router();

// Os números agregados da empresa são da gestão (Administrador e RH). Cada rota devolve JSON e, com
// ?formato=csv ou ?formato=pdf, o mesmo relatório para baixar.
relatoriosRoutes.use(exigirPermissao('relatorios:consultar'));

relatoriosRoutes.get('/headcount', validarEntrada({ query: consultarHeadcount }), relatoriosController.headcount);
relatoriosRoutes.get('/aniversariantes', validarEntrada({ query: consultarAniversariantes }), relatoriosController.aniversariantes);
relatoriosRoutes.get('/custo-departamento', validarEntrada({ query: consultarCusto }), relatoriosController.custoPorDepartamento);
relatoriosRoutes.get('/absenteismo', validarEntrada({ query: consultarAbsenteismo }), relatoriosController.absenteismo);
