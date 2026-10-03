import express from 'express';
import * as dashboardController from './dashboard.controller.ts';
import verificarPerfil from '../../shared/middlewares/roleMiddleware.js';

export const dashboardRoutes = express.Router();

dashboardRoutes.get('/resumo', verificarPerfil(['Administrador', 'RH']), dashboardController.resumo);
