// Camada HTTP das solicitações de alteração cadastral: lê o que a requisição traz, chama o serviço e
// escreve a resposta. As regras ficam em solicitacoes.service.ts.
import type { Request, Response } from 'express';
import * as service from './solicitacoes.service.ts';
import { ErroDeSolicitacao } from './solicitacoes.erros.ts';
import type { TipoDeErro } from './solicitacoes.erros.ts';
import type { ConsultaDeSolicitacoes, CorpoDaDecisao, IdDaRota, PedidoDeAlteracao } from './solicitacoes.schemas.ts';
import { autoriaDe } from '../../shared/utils/auditar.ts';
import { responderErro } from '../../shared/utils/erros.ts';
import { enviarPagina } from '../../shared/utils/paginacao.ts';

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { invalido: 400, proibido: 403, inexistente: 404, conflito: 409 };

// Falha de regra vira a resposta que o serviço descreveu; qualquer outra passa por responderErro,
// que converte falhas conhecidas do MySQL em 4xx/503 e devolve 500 com a mensagem do endpoint.
const responderFalha = (res: Response, erro: unknown, mensagem500: string) => {
    if (erro instanceof ErroDeSolicitacao) return res.status(STATUS_POR_TIPO[erro.tipo]).json(erro.corpo);
    return responderErro(res, erro, mensagem500);
};

// O authMiddleware, que roda antes de qualquer rota das solicitações, preenche req.usuario.
const operadorDe = (req: Request): service.Operador => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota das solicitações precisa do authMiddleware.');
    const { id, empresa_id, perfil, funcionario_id } = req.usuario;
    return { id, empresa_id, perfil, funcionario_id };
};

// O validarEntrada da rota já validou e normalizou a entrada; os tipos vêm de solicitacoes.schemas.ts.
const entradaDe = <T>(req: Request, parte: 'params' | 'body' | 'query'): T => {
    if (!req.dadosValidados?.[parte]) throw new Error(`req.dadosValidados.${parte} ausente: a rota precisa do validarEntrada.`);
    return req.dadosValidados[parte] as T;
};

export const criarSolicitacao = async (req: Request, res: Response) => {
    try {
        res.status(201).json(await service.criarSolicitacao(operadorDe(req), autoriaDe(req), entradaDe<PedidoDeAlteracao>(req, 'body')));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao registrar a solicitação.');
    }
};

export const minhasSolicitacoes = async (req: Request, res: Response) => {
    try {
        res.json(await service.minhasSolicitacoes(operadorDe(req)));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar as suas solicitações.');
    }
};

export const listarSolicitacoes = async (req: Request, res: Response) => {
    try {
        const { solicitacoes, total } = await service.listarSolicitacoes(operadorDe(req), entradaDe<ConsultaDeSolicitacoes>(req, 'query'));
        enviarPagina(res, solicitacoes, total);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar as solicitações.');
    }
};

export const decidirSolicitacao = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaRota>(req, 'params');
        res.json(await service.decidirSolicitacao(operadorDe(req), autoriaDe(req), id, entradaDe<CorpoDaDecisao>(req, 'body')));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao decidir a solicitação.');
    }
};
