import express from 'express';
import * as estruturaController from './estrutura.controller.ts';
import { exigirPermissao } from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { idDaRota, departamento, cargo } from './estrutura.schemas.ts';
import { paginacao } from '../../shared/schemas/paginacao.ts';

export const estruturaRoutes = express.Router();

// O RH consulta cargos e departamentos (precisa deles para cadastrar colaboradores); só o Administrador altera.
const consultar = exigirPermissao('estrutura:consultar');
const gerir = exigirPermissao('estrutura:gerir');

// Rotas de Departamentos
estruturaRoutes.get('/departamentos', consultar, validarEntrada({ query: paginacao }), estruturaController.listarDepartamentos);
estruturaRoutes.post('/departamentos', gerir, validarEntrada({ body: departamento }), estruturaController.criarDepartamento);
estruturaRoutes.put('/departamentos/:id', gerir, validarEntrada({ params: idDaRota, body: departamento }), estruturaController.atualizarDepartamento);
estruturaRoutes.delete('/departamentos/:id', gerir, validarEntrada({ params: idDaRota }), estruturaController.deletarDepartamento);

// Rotas de Cargos
estruturaRoutes.get('/cargos', consultar, validarEntrada({ query: paginacao }), estruturaController.listarCargos);
estruturaRoutes.post('/cargos', gerir, validarEntrada({ body: cargo }), estruturaController.criarCargo);
estruturaRoutes.put('/cargos/:id', gerir, validarEntrada({ params: idDaRota, body: cargo }), estruturaController.atualizarCargo);
estruturaRoutes.delete('/cargos/:id', gerir, validarEntrada({ params: idDaRota }), estruturaController.deletarCargo);
