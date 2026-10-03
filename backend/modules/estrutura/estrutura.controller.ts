// Camada HTTP da estrutura organizacional: lê o que a requisição traz, chama o serviço e escreve a
// resposta. As regras ficam em estrutura.service.ts.
import type { Request, Response } from 'express';
import * as service from './estrutura.service.ts';
import { ErroDeEstrutura } from './estrutura.erros.ts';
import type { TipoDeErro } from './estrutura.erros.ts';
import type { DadosDoCargo, DadosDoDepartamento, IdDaRota } from './estrutura.schemas.ts';
import { responderErro } from '../../shared/utils/erros.ts';
import { enviarPagina } from '../../shared/utils/paginacao.ts';

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { invalido: 400, inexistente: 404 };

// Falha de regra vira a resposta que o serviço descreveu; qualquer outra passa por
// responderErro (shared/utils/erros.ts), que traduz falhas conhecidas do MySQL e devolve 500 com a
// mensagem do endpoint para o resto.
const responderFalha = (res: Response, erro: unknown, mensagem500: string) => {
    if (erro instanceof ErroDeEstrutura) return res.status(STATUS_POR_TIPO[erro.tipo]).json(erro.corpo);
    return responderErro(res, erro, mensagem500);
};

// O authMiddleware, que roda antes de qualquer rota da estrutura, preenche req.usuario.
// SEGURANÇA: a empresa vem do token, nunca da requisição.
const empresaDe = (req: Request): number => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota da estrutura precisa do authMiddleware.');
    return req.usuario.empresa_id;
};

// O validarEntrada da rota já validou e normalizou a entrada; os tipos vêm de estrutura.schemas.ts.
const entradaDe = <T>(req: Request, parte: 'params' | 'body' | 'query'): T => {
    if (!req.dadosValidados?.[parte]) throw new Error(`req.dadosValidados.${parte} ausente: a rota precisa do validarEntrada.`);
    return req.dadosValidados[parte] as T;
};

const consultaDe = (req: Request) => entradaDe<{ pagina: number; limite: number }>(req, 'query');

// ==========================================
// DEPARTAMENTOS
// ==========================================

export const listarDepartamentos = async (req: Request, res: Response) => {
    try {
        const { registros, total } = await service.listarDepartamentos(empresaDe(req), consultaDe(req));
        enviarPagina(res, registros, total);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar departamentos.');
    }
};

export const criarDepartamento = async (req: Request, res: Response) => {
    try {
        await service.criarDepartamento(empresaDe(req), entradaDe<DadosDoDepartamento>(req, 'body'));
        res.status(201).json({ mensagem: 'Departamento criado com sucesso!' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao salvar o departamento.');
    }
};

export const atualizarDepartamento = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaRota>(req, 'params');
        await service.atualizarDepartamento(id, empresaDe(req), entradaDe<DadosDoDepartamento>(req, 'body'));
        res.json({ mensagem: 'Departamento atualizado com sucesso!' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao modificar o departamento.');
    }
};

export const deletarDepartamento = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaRota>(req, 'params');
        await service.removerDepartamento(id, empresaDe(req));
        res.json({ mensagem: 'Departamento removido com sucesso!' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao remover o departamento.');
    }
};

// ==========================================
// CARGOS
// ==========================================

export const listarCargos = async (req: Request, res: Response) => {
    try {
        const { registros, total } = await service.listarCargos(empresaDe(req), consultaDe(req));
        enviarPagina(res, registros, total);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar cargos.');
    }
};

export const criarCargo = async (req: Request, res: Response) => {
    try {
        await service.criarCargo(empresaDe(req), entradaDe<DadosDoCargo>(req, 'body'));
        res.status(201).json({ mensagem: 'Cargo estruturado com sucesso!' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao salvar o cargo.');
    }
};

export const atualizarCargo = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaRota>(req, 'params');
        await service.atualizarCargo(id, empresaDe(req), entradaDe<DadosDoCargo>(req, 'body'));
        res.json({ mensagem: 'Cargo modificado com sucesso!' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao modificar o cargo.');
    }
};

export const deletarCargo = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaRota>(req, 'params');
        await service.removerCargo(id, empresaDe(req));
        res.json({ mensagem: 'Cargo removido com sucesso!' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao remover o cargo.');
    }
};
