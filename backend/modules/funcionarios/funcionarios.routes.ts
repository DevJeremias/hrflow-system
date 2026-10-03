import express from 'express';
import * as funcionariosController from './funcionarios.controller.ts';
import { exigirPermissao } from '../../shared/middlewares/roleMiddleware.ts';
import validarEntrada from '../../shared/middlewares/validarEntrada.ts';
import { idDaRota, idDoDependente, consultaDeFuncionarios, criarFuncionario, atualizarFuncionario, alterarStatus, dependente, arquivoCsv } from './funcionarios.schemas.ts';

export const funcionariosRoutes = express.Router();

// Todas as rotas são de Administrador e RH; o alcance do RH sobre cada cadastro é decidido no serviço.
const apenasRH = exigirPermissao('colaboradores:gerir');

// Só o texto do CSV, até 2 MB (500 linhas de planilha cabem em poucas centenas de KB); o parser global só lê JSON.
const corpoCsv = express.text({ type: ['text/csv', 'text/plain'], limit: '2mb' });

funcionariosRoutes.post('/', apenasRH, validarEntrada({ body: criarFuncionario }), funcionariosController.criarFuncionario);
funcionariosRoutes.get('/', apenasRH, validarEntrada({ query: consultaDeFuncionarios }), funcionariosController.listarFuncionarios);
funcionariosRoutes.delete('/:id', apenasRH, validarEntrada({ params: idDaRota }), funcionariosController.deletarFuncionario);
funcionariosRoutes.post('/importar', apenasRH, corpoCsv, validarEntrada({ body: arquivoCsv }), funcionariosController.importarFuncionarios);
// Edição parcial: só os campos enviados mudam.
funcionariosRoutes.patch('/:id', apenasRH, validarEntrada({ params: idDaRota, body: atualizarFuncionario }), funcionariosController.atualizarFuncionario);
funcionariosRoutes.patch('/:id/status', apenasRH, validarEntrada({ params: idDaRota, body: alterarStatus }), funcionariosController.alterarStatus);
funcionariosRoutes.post('/:id/redefinir-senha', apenasRH, validarEntrada({ params: idDaRota }), funcionariosController.redefinirSenha);

funcionariosRoutes.get('/:id/dependentes', apenasRH, validarEntrada({ params: idDaRota }), funcionariosController.listarDependentes);
funcionariosRoutes.post('/:id/dependentes', apenasRH, validarEntrada({ params: idDaRota, body: dependente }), funcionariosController.criarDependente);
funcionariosRoutes.put('/:id/dependentes/:dependenteId', apenasRH, validarEntrada({ params: idDoDependente, body: dependente }), funcionariosController.atualizarDependente);
funcionariosRoutes.delete('/:id/dependentes/:dependenteId', apenasRH, validarEntrada({ params: idDoDependente }), funcionariosController.excluirDependente);

// Histórico contratual e direitos do titular. Exportar é da gestão; anonimizar é irreversível e só do Administrador.
funcionariosRoutes.get('/:id/historico-contratual', apenasRH, validarEntrada({ params: idDaRota }), funcionariosController.historicoContratual);
funcionariosRoutes.get('/:id/exportar', exigirPermissao('colaboradores:exportar'), validarEntrada({ params: idDaRota }), funcionariosController.exportarDados);
funcionariosRoutes.post('/:id/anonimizar', exigirPermissao('colaboradores:anonimizar'), validarEntrada({ params: idDaRota }), funcionariosController.anonimizarFuncionario);
