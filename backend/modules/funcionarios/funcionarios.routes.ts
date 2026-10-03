import express from 'express';
import * as funcionariosController from './funcionarios.controller.ts';
import { exigirPermissao } from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { idDaRota, dependenteDaRota, consultaDeFuncionarios, criarFuncionario, criarDependente, atualizarFuncionario, alterarStatus } from './funcionarios.schemas.ts';

export const funcionariosRoutes = express.Router();

// Todas as rotas são de Administrador e RH; o alcance do RH sobre cada cadastro é decidido no serviço.
const apenasRH = exigirPermissao('colaboradores:gerir');

funcionariosRoutes.post('/', apenasRH, validarEntrada({ body: criarFuncionario }), funcionariosController.criarFuncionario);
funcionariosRoutes.get('/', apenasRH, validarEntrada({ query: consultaDeFuncionarios }), funcionariosController.listarFuncionarios);
funcionariosRoutes.delete('/:id', apenasRH, validarEntrada({ params: idDaRota }), funcionariosController.deletarFuncionario);
funcionariosRoutes.put('/:id', apenasRH, validarEntrada({ params: idDaRota, body: atualizarFuncionario }), funcionariosController.atualizarFuncionario);
funcionariosRoutes.patch('/:id/status', apenasRH, validarEntrada({ params: idDaRota, body: alterarStatus }), funcionariosController.alterarStatus);
funcionariosRoutes.post('/:id/redefinir-senha', apenasRH, validarEntrada({ params: idDaRota }), funcionariosController.redefinirSenha);

// Dependentes que reduzem o IRRF na folha: ler vale para qualquer colaborador; alterar segue o alcance do cadastro.
funcionariosRoutes.get('/:id/dependentes', apenasRH, validarEntrada({ params: idDaRota }), funcionariosController.listarDependentes);
funcionariosRoutes.post('/:id/dependentes', apenasRH, validarEntrada({ params: idDaRota, body: criarDependente }), funcionariosController.adicionarDependente);
funcionariosRoutes.delete('/:id/dependentes/:dependenteId', apenasRH, validarEntrada({ params: dependenteDaRota }), funcionariosController.removerDependente);
