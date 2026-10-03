import express from 'express';
import * as pontoController from './ponto.controller.ts';
import { exigirPermissao } from '../../shared/middlewares/roleMiddleware.ts';
import { verificarAcessoFuncionario } from '../funcionarios/index.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { decidirJustificativa, diaDaJustificativa, enviarJustificativa, consultarJustificativas, consultarPontosDaEmpresa, idDaJustificativa } from './ponto.schemas.ts';

export const pontoRoutes = express.Router();

pontoRoutes.post('/registrar', pontoController.registrarPonto);
pontoRoutes.get('/hoje/:funcionarioId', verificarAcessoFuncionario, pontoController.listarPontosHoje);
pontoRoutes.get('/historico/:funcionarioId', verificarAcessoFuncionario, pontoController.listarHistorico);
pontoRoutes.get('/totais/:funcionarioId', verificarAcessoFuncionario, pontoController.listarTotais);
pontoRoutes.get('/', exigirPermissao('ponto:consultar-empresa'), validarEntrada({ query: consultarPontosDaEmpresa }), pontoController.listarPontos);
pontoRoutes.put('/justificativa/:data', validarEntrada({ params: diaDaJustificativa, body: enviarJustificativa }), pontoController.enviarJustificativa);
pontoRoutes.get('/justificativas', exigirPermissao('ponto:consultar-empresa'), validarEntrada({ query: consultarJustificativas }), pontoController.listarJustificativas);
pontoRoutes.patch('/justificativas/:id', exigirPermissao('ponto:consultar-empresa'), validarEntrada({ params: idDaJustificativa, body: decidirJustificativa }), pontoController.decidirJustificativa);
