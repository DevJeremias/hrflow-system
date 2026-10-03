import express from 'express';
import * as funcionariosController from './funcionarios.controller.ts';
import verificarPerfil from '../../shared/middlewares/roleMiddleware.js';
import validarEntrada from '../../shared/middlewares/validarEntrada.js';
import { paginacao } from '../../shared/schemas/paginacao.js';
import { idDaRota, criarFuncionario, atualizarFuncionario } from './funcionarios.schemas.ts';

export const funcionariosRoutes = express.Router();

// Todas as rotas são de Administrador e RH.
const apenasRH = verificarPerfil(['Administrador', 'RH']);

funcionariosRoutes.post('/', apenasRH, validarEntrada({ body: criarFuncionario }), funcionariosController.criarFuncionario);
funcionariosRoutes.get('/', apenasRH, validarEntrada({ query: paginacao }), funcionariosController.listarFuncionarios);
funcionariosRoutes.delete('/:id', apenasRH, validarEntrada({ params: idDaRota }), funcionariosController.deletarFuncionario);
funcionariosRoutes.put('/:id', apenasRH, validarEntrada({ params: idDaRota, body: atualizarFuncionario }), funcionariosController.atualizarFuncionario);
