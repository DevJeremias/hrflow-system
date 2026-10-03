import express from 'express';
import * as folhaController from './folha.controller.ts';
import verificarPerfil from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { competenciaDaRota, consultarHolerite } from './folha.schemas.ts';

export const folhaRoutes = express.Router();

// Folha da empresa: apenas Administrador e RH.
const gestao = verificarPerfil(['Administrador', 'RH']);
const daCompetencia = validarEntrada({ params: competenciaDaRota });

folhaRoutes.get('/competencias/:competencia', gestao, daCompetencia, folhaController.consultarFolha);
folhaRoutes.post('/competencias/:competencia/processar', gestao, daCompetencia, folhaController.processarFolha);
folhaRoutes.post('/competencias/:competencia/fechar', gestao, daCompetencia, folhaController.fecharFolha);

// Rotas individuais: qualquer pessoa logada vê o SEU próprio holerite, e só o de folha fechada.
folhaRoutes.get('/meu-holerite', validarEntrada({ query: consultarHolerite }), folhaController.meuHolerite);
folhaRoutes.get('/meus-holerites', folhaController.meusHolerites);
