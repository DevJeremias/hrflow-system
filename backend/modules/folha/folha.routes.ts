import express from 'express';
import * as folhaController from './folha.controller.ts';
import { exigirPermissao } from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { competenciaDaRota, competenciaEColaborador, consultarHolerite, lancamentosDoColaborador } from './folha.schemas.ts';

export const folhaRoutes = express.Router();

// Folha da empresa: apenas Administrador e RH.
const gestao = exigirPermissao('folha:processar');
const daCompetencia = validarEntrada({ params: competenciaDaRota });

folhaRoutes.get('/competencias/:competencia', gestao, daCompetencia, folhaController.consultarFolha);
folhaRoutes.post('/competencias/:competencia/processar', gestao, daCompetencia, folhaController.processarFolha);
folhaRoutes.post('/competencias/:competencia/fechar', gestao, daCompetencia, folhaController.fecharFolha);
folhaRoutes.put('/competencias/:competencia/lancamentos/:funcionarioId', gestao, validarEntrada({ params: competenciaEColaborador, body: lancamentosDoColaborador }), folhaController.lancarEventos);
folhaRoutes.get('/competencias/:competencia/holerites.pdf', gestao, daCompetencia, folhaController.holeritesEmPdf);
folhaRoutes.get('/competencias/:competencia/holerites/:funcionarioId.pdf', gestao, validarEntrada({ params: competenciaEColaborador }), folhaController.holeriteEmPdf);

// Rotas individuais: qualquer pessoa logada vê o SEU próprio holerite, e só o de folha fechada.
folhaRoutes.get('/meu-holerite', validarEntrada({ query: consultarHolerite }), folhaController.meuHolerite);
folhaRoutes.get('/meu-holerite.pdf', validarEntrada({ query: consultarHolerite }), folhaController.meuHoleriteEmPdf);
folhaRoutes.get('/meus-holerites', folhaController.meusHolerites);
