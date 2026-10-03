// Camada HTTP de funcionários: lê o que a requisição traz, chama o serviço e escreve a resposta.
// As regras ficam em funcionarios.service.ts.
import type { Request, Response } from 'express';
import * as service from './funcionarios.service.ts';
import { ErroDeFuncionario } from './funcionarios.erros.ts';
import type { TipoDeErro } from './funcionarios.erros.ts';
import type { CorpoDaEdicao, CorpoDoCadastro, IdDaRota, Paginacao } from './funcionarios.schemas.ts';
import { responderErro } from '../../shared/utils/erros.js';
import { enviarPagina } from '../../shared/utils/paginacao.js';

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { invalido: 400, inexistente: 404 };

// Falha de regra vira a resposta que o serviço descreveu; qualquer outra passa por responderErro,
// que converte falhas conhecidas do MySQL em 4xx/503 e devolve 500 com a mensagem do endpoint.
const responderFalha = (res: Response, erro: unknown, mensagem500: string) => {
    if (erro instanceof ErroDeFuncionario) return res.status(STATUS_POR_TIPO[erro.tipo]).json(erro.corpo);
    return responderErro(res, erro, mensagem500);
};

// O authMiddleware, que roda antes de qualquer rota de funcionários, preenche req.usuario.
const empresaDe = (req: Request): number => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota de funcionários precisa do authMiddleware.');
    return req.usuario.empresa_id;
};

// O validarEntrada da rota já validou e normalizou a entrada; os tipos vêm de funcionarios.schemas.ts.
const entradaDe = <T>(req: Request, parte: 'params' | 'body' | 'query'): T => {
    if (!req.dadosValidados?.[parte]) throw new Error(`req.dadosValidados.${parte} ausente: a rota precisa do validarEntrada.`);
    return req.dadosValidados[parte] as T;
};

export const listarFuncionarios = async (req: Request, res: Response) => {
    try {
        const { funcionarios, total } = await service.listarFuncionarios(empresaDe(req), entradaDe<Paginacao>(req, 'query'));
        enviarPagina(res, funcionarios, total);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar funcionários.');
    }
};

export const criarFuncionario = async (req: Request, res: Response) => {
    try {
        await service.criarFuncionario(empresaDe(req), entradaDe<CorpoDoCadastro>(req, 'body'));
        res.status(201).json({ mensagem: 'Colaborador e credenciais de acesso criados com sucesso!' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao processar o cadastro.');
    }
};

export const atualizarFuncionario = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaRota>(req, 'params');
        await service.atualizarFuncionario(empresaDe(req), id, entradaDe<CorpoDaEdicao>(req, 'body'));
        res.json({ mensagem: 'Funcionário atualizado com sucesso!' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao modificar o funcionário.');
    }
};

export const deletarFuncionario = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaRota>(req, 'params');
        await service.deletarFuncionario(empresaDe(req), id);
        res.json({ mensagem: 'Funcionário removido com sucesso!' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao remover o funcionário.');
    }
};
