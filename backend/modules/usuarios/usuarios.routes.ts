import express from 'express';
import * as usuariosController from './usuarios.controller.ts';
import { exigirPermissao } from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { paginacao } from '../../shared/schemas/paginacao.ts';
import { idDaRota, criarUsuario, atualizarUsuario } from './usuarios.schemas.ts';

export const usuariosRoutes = express.Router();

// Contas de acesso são só do Administrador: é quem cria RH e Administradores e muda perfis.
usuariosRoutes.use(exigirPermissao('usuarios:gerir'));

usuariosRoutes.get('/', validarEntrada({ query: paginacao }), usuariosController.listarUsuarios);
usuariosRoutes.post('/', validarEntrada({ body: criarUsuario }), usuariosController.criarUsuario);
usuariosRoutes.patch('/:id', validarEntrada({ params: idDaRota, body: atualizarUsuario }), usuariosController.atualizarUsuario);
