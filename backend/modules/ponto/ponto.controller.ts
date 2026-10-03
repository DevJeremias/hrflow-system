// Camada HTTP do ponto: lê o que a requisição traz, chama o serviço e escreve a resposta. As regras
// ficam em ponto.service.ts.
import type { Request, Response } from 'express';
import * as service from './ponto.service.ts';
import { ErroDePonto } from './ponto.erros.ts';
import type { TipoDeErro } from './ponto.erros.ts';
import type { ConsultaDeJustificativas, ConsultaDePontosDaEmpresa, CorpoDaJustificativa, DiaDaJustificativa } from './ponto.schemas.ts';
import { responderErro } from '../../shared/utils/erros.js';
import { enviarPagina } from '../../shared/utils/paginacao.js';

type RequisicaoDoColaborador = Request<{ funcionarioId: string }>;

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { proibido: 403, invalido: 400, inexistente: 404, conflito: 409 };

// Falha de regra vira a resposta que o serviço descreveu; qualquer outra é 500 com a mensagem do
// endpoint. `traduzirBanco` também converte falhas conhecidas do MySQL em 4xx/503 (utils/erros.js).
const responderFalha = (res: Response, erro: unknown, mensagem500: string, { traduzirBanco = false } = {}) => {
    if (erro instanceof ErroDePonto) return res.status(STATUS_POR_TIPO[erro.tipo]).json(erro.corpo);
    if (traduzirBanco) return responderErro(res, erro, mensagem500);
    console.error(`${mensagem500}:`, erro);
    return res.status(500).json({ erro: mensagem500 });
};

// O authMiddleware, que roda antes de qualquer rota do ponto, preenche req.usuario.
const usuarioDe = (req: Request) => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota do ponto precisa do authMiddleware.');
    return req.usuario;
};

// O validarEntrada da rota já validou e normalizou a entrada; os tipos vêm de ponto.schemas.ts.
const entradaDe = <T>(req: Request, parte: 'params' | 'body' | 'query'): T => {
    if (!req.dadosValidados?.[parte]) throw new Error(`req.dadosValidados.${parte} ausente: a rota precisa do validarEntrada.`);
    return req.dadosValidados[parte] as T;
};

export const registrarPonto = async (req: Request, res: Response) => {
    try {
        // SEGURANÇA: empresa e colaborador vêm do token criptografado, não do req.body
        const { empresa_id, funcionario_id } = usuarioDe(req);
        const registro = await service.registrarPonto({ empresaId: empresa_id, funcionarioId: funcionario_id, corpo: req.body });
        res.status(201).json(registro);
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao salvar o registro de ponto.');
    }
};

export const listarPontosHoje = async (req: RequisicaoDoColaborador, res: Response) => {
    try {
        const registros = await service.listarPontosHoje({
            empresaId: usuarioDe(req).empresa_id,
            funcionarioId: req.params.funcionarioId,
        });
        res.json(registros);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar pontos de hoje.');
    }
};

export const listarHistorico = async (req: RequisicaoDoColaborador, res: Response) => {
    try {
        const dias = await service.listarHistorico({
            empresaId: usuarioDe(req).empresa_id,
            funcionarioId: req.params.funcionarioId,
            mes: req.query.mes,
        });
        res.json(dias);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar histórico.');
    }
};

export const listarTotais = (_req: RequisicaoDoColaborador, res: Response) => {
    res.json(service.listarTotais());
};

export const listarPontos = async (req: Request, res: Response) => {
    try {
        const { registros, total } = await service.listarPontosDaEmpresa({
            empresaId: usuarioDe(req).empresa_id,
            consulta: entradaDe<ConsultaDePontosDaEmpresa>(req, 'query'),
        });
        enviarPagina(res, registros, total);
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao buscar os registros.');
    }
};

export const enviarJustificativa = async (req: Request, res: Response) => {
    try {
        const { empresa_id, funcionario_id } = usuarioDe(req);
        const { data } = entradaDe<DiaDaJustificativa>(req, 'params');
        const { texto } = entradaDe<CorpoDaJustificativa>(req, 'body');
        const justificativa = await service.enviarJustificativa({ empresaId: empresa_id, funcionarioId: funcionario_id, data, texto });
        res.json(justificativa);
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao salvar a justificativa.', { traduzirBanco: true });
    }
};

export const listarJustificativas = async (req: Request, res: Response) => {
    try {
        const { mes, funcionarioId } = entradaDe<ConsultaDeJustificativas>(req, 'query');
        res.json(await service.listarJustificativas({ empresaId: usuarioDe(req).empresa_id, mes, funcionarioId }));
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao buscar as justificativas.', { traduzirBanco: true });
    }
};
