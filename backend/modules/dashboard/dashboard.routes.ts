import express from 'express';
import * as dashboardController from './dashboard.controller.ts';
import { exigirPermissao } from '../../shared/middlewares/roleMiddleware.ts';

export const dashboardRoutes = express.Router();

dashboardRoutes.get('/resumo', exigirPermissao('dashboard:consultar'), dashboardController.resumo);
