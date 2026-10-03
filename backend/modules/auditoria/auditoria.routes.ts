import express from 'express';
import * as auditoriaController from './auditoria.controller.ts';
import { exigirPermissao } from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { consultaDeAuditoria } from './auditoria.schemas.ts';

export const auditoriaRoutes = express.Router();

// A gestão (Administrador e RH) lê a trilha da própria empresa.
auditoriaRoutes.get('/', exigirPermissao('auditoria:consultar'), validarEntrada({ query: consultaDeAuditoria }), auditoriaController.listarAuditoria);
