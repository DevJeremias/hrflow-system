import express from 'express';
import * as estruturaController from './estrutura.controller.ts';
import verificarPerfil from '../../shared/middlewares/roleMiddleware.js';
import validarEntrada from '../../shared/middlewares/validarEntrada.js';
import { idDaRota, departamento, cargo } from './estrutura.schemas.ts';
import { paginacao } from '../../shared/schemas/paginacao.js';

export const estruturaRoutes = express.Router();

// Protege todas as rotas de estrutura. Apenas Administrador e RH podem gerir.
estruturaRoutes.use(verificarPerfil(['Administrador', 'RH']));

// Rotas de Departamentos
estruturaRoutes.get('/departamentos', validarEntrada({ query: paginacao }), estruturaController.listarDepartamentos);
estruturaRoutes.post('/departamentos', validarEntrada({ body: departamento }), estruturaController.criarDepartamento);
estruturaRoutes.put('/departamentos/:id', validarEntrada({ params: idDaRota, body: departamento }), estruturaController.atualizarDepartamento);
estruturaRoutes.delete('/departamentos/:id', validarEntrada({ params: idDaRota }), estruturaController.deletarDepartamento);

// Rotas de Cargos
estruturaRoutes.get('/cargos', validarEntrada({ query: paginacao }), estruturaController.listarCargos);
estruturaRoutes.post('/cargos', validarEntrada({ body: cargo }), estruturaController.criarCargo);
estruturaRoutes.put('/cargos/:id', validarEntrada({ params: idDaRota, body: cargo }), estruturaController.atualizarCargo);
estruturaRoutes.delete('/cargos/:id', validarEntrada({ params: idDaRota }), estruturaController.deletarCargo);
