import express from 'express';
import * as notificacoesController from './notificacoes.controller.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { consultarNotificacoes, idDaNotificacao } from './notificacoes.schemas.ts';

export const notificacoesRoutes = express.Router();

// Cada pessoa lê e marca só os próprios avisos, em qualquer perfil: não há permissão a pedir.
notificacoesRoutes.get('/', validarEntrada({ query: consultarNotificacoes }), notificacoesController.listarNotificacoes);
notificacoesRoutes.post('/lidas', notificacoesController.marcarTodasComoLidas);
notificacoesRoutes.post('/:id/lida', validarEntrada({ params: idDaNotificacao }), notificacoesController.marcarComoLida);
