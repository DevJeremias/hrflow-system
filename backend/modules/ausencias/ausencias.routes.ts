import express from 'express';
import * as ausenciasController from './ausencias.controller.ts';
import { exigirPermissao } from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { verificarAcessoFuncionario } from '../../shared/middlewares/acessoFuncionario.ts';
import { colaboradorDoSaldo, consultarAusencias, decidirAusencia, idDaAusencia, solicitarAusencia } from './ausencias.schemas.ts';

export const ausenciasRoutes = express.Router();

// O que é do próprio colaborador (pedir, ver os seus, baixar o anexo) vale para qualquer perfil com cadastro.
ausenciasRoutes.post('/', validarEntrada({ body: solicitarAusencia }), ausenciasController.solicitar);
ausenciasRoutes.get('/minhas', ausenciasController.listarMinhas);
ausenciasRoutes.get('/saldo/:funcionarioId', verificarAcessoFuncionario, validarEntrada({ params: colaboradorDoSaldo }), ausenciasController.saldo);
ausenciasRoutes.get('/:id/anexo', validarEntrada({ params: idDaAusencia }), ausenciasController.baixarAnexo);

// A fila e a decisão são de quem gere ausências; o alcance sobre cada pedido é decidido no serviço.
ausenciasRoutes.get('/', exigirPermissao('ausencias:gerir'), validarEntrada({ query: consultarAusencias }), ausenciasController.listarDaEmpresa);
ausenciasRoutes.patch('/:id/decisao', exigirPermissao('ausencias:gerir'), validarEntrada({ params: idDaAusencia, body: decidirAusencia }), ausenciasController.decidir);
