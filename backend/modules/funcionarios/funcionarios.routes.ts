import express from 'express';
import * as funcionariosController from './funcionarios.controller.ts';
import verificarPerfil from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { paginacao } from '../../shared/schemas/paginacao.ts';
import { idDaRota, criarFuncionario, atualizarFuncionario, alterarStatus } from './funcionarios.schemas.ts';

export const funcionariosRoutes = express.Router();

// Todas as rotas são de Administrador e RH.
const apenasRH = verificarPerfil(['Administrador', 'RH']);

funcionariosRoutes.post('/', apenasRH, validarEntrada({ body: criarFuncionario }), funcionariosController.criarFuncionario);
funcionariosRoutes.get('/', apenasRH, validarEntrada({ query: paginacao }), funcionariosController.listarFuncionarios);
funcionariosRoutes.delete('/:id', apenasRH, validarEntrada({ params: idDaRota }), funcionariosController.deletarFuncionario);
funcionariosRoutes.put('/:id', apenasRH, validarEntrada({ params: idDaRota, body: atualizarFuncionario }), funcionariosController.atualizarFuncionario);
funcionariosRoutes.patch('/:id/status', apenasRH, validarEntrada({ params: idDaRota, body: alterarStatus }), funcionariosController.alterarStatus);
funcionariosRoutes.post('/:id/redefinir-senha', apenasRH, validarEntrada({ params: idDaRota }), funcionariosController.redefinirSenha);
