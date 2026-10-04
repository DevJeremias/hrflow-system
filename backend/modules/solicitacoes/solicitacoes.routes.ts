import express from 'express';
import * as solicitacoesController from './solicitacoes.controller.ts';
import verificarPerfil, { exigirPermissao } from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { criarLimitadores } from '../../shared/middlewares/limitesAuth.ts';
import { consultaDeSolicitacoes, criarSolicitacao, decidirSolicitacao, idDaRota } from './solicitacoes.schemas.ts';

const limitadores = criarLimitadores();

export const solicitacoesRoutes = express.Router();

// Qualquer perfil pede (o Administrador recebe a orientação de alterar direto) e vê os próprios pedidos.
// Trocar o e-mail confere a senha atual: o limite conta as tentativas erradas.
const todos = verificarPerfil(['Administrador', 'RH', 'Colaborador']);
solicitacoesRoutes.post('/', todos, validarEntrada({ body: criarSolicitacao }), limitadores.confirmarSenhaPorUsuario, solicitacoesController.criarSolicitacao);
solicitacoesRoutes.get('/minhas', todos, solicitacoesController.minhasSolicitacoes);

// Quem gere decide. O alcance de cada pedido (o RH não decide o de outro RH nem o próprio) é do serviço.
const gestao = exigirPermissao('solicitacoes:decidir');
solicitacoesRoutes.get('/', gestao, validarEntrada({ query: consultaDeSolicitacoes }), solicitacoesController.listarSolicitacoes);
solicitacoesRoutes.patch('/:id', gestao, validarEntrada({ params: idDaRota, body: decidirSolicitacao }), solicitacoesController.decidirSolicitacao);
