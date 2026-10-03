// Camada HTTP da folha: lê o que a requisição traz, chama o serviço e escreve a resposta. As regras
// ficam em folha.service.ts.
import type { Request, Response } from 'express';
import * as service from './folha.service.ts';
import { ErroDeFolha } from './folha.erros.ts';
import type { TipoDeErro } from './folha.erros.ts';
import type { CompetenciaDaRota, ConsultaDeHolerite } from './folha.schemas.ts';
import { autoriaDe } from '../../shared/utils/auditar.ts';
import { responderErro } from '../../shared/utils/erros.ts';

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { invalido: 400, inexistente: 404, conflito: 409, incompleto: 422 };

// Falha de regra vira a resposta que o serviço descreveu; qualquer outra passa por responderErro
// (shared/utils/erros.ts), que traduz falhas conhecidas do MySQL em 4xx/503 e devolve 500 com a mensagem
// do endpoint.
const responderFalha = (res: Response, erro: unknown, mensagem500: string) => {
    if (erro instanceof ErroDeFolha) return res.status(STATUS_POR_TIPO[erro.tipo]).json(erro.corpo);
    return responderErro(res, erro, mensagem500);
};

// O authMiddleware, que roda antes de qualquer rota da folha, preenche req.usuario.
const usuarioDe = (req: Request) => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota da folha precisa do authMiddleware.');
    return req.usuario;
};

// O validarEntrada da rota já validou e normalizou a entrada; os tipos vêm de folha.schemas.ts.
const entradaDe = <T>(req: Request, parte: 'params' | 'query'): T => {
    if (!req.dadosValidados?.[parte]) throw new Error(`req.dadosValidados.${parte} ausente: a rota precisa do validarEntrada.`);
    return req.dadosValidados[parte] as T;
};

export const consultarFolha = async (req: Request, res: Response) => {
    try {
        // SEGURANÇA: a empresa vem do token, nunca da requisição.
        const { competencia } = entradaDe<CompetenciaDaRota>(req, 'params');
        res.json(await service.consultarFolha({ empresaId: usuarioDe(req).empresa_id, competencia }));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar a folha de pagamento');
    }
};

export const processarFolha = async (req: Request, res: Response) => {
    try {
        const { competencia } = entradaDe<CompetenciaDaRota>(req, 'params');
        const { folha, criada } = await service.processarFolha({ empresaId: usuarioDe(req).empresa_id, competencia, autoria: autoriaDe(req) });
        res.status(criada ? 201 : 200).json(folha);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao processar folha de pagamento');
    }
};

export const fecharFolha = async (req: Request, res: Response) => {
    try {
        const { empresa_id, id } = usuarioDe(req);
        const { competencia } = entradaDe<CompetenciaDaRota>(req, 'params');
        res.json(await service.fecharFolha({ empresaId: empresa_id, usuarioId: id, competencia, autoria: autoriaDe(req) }));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao fechar a folha de pagamento');
    }
};

export const meuHolerite = async (req: Request, res: Response) => {
    try {
        const { id, empresa_id } = usuarioDe(req);
        const { competencia } = entradaDe<ConsultaDeHolerite>(req, 'query');
        res.json(await service.meuHolerite({ usuarioId: id, empresaId: empresa_id, competencia }));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar holerite');
    }
};

export const meusHolerites = async (req: Request, res: Response) => {
    try {
        const { id, empresa_id } = usuarioDe(req);
        res.json(await service.meusHolerites({ usuarioId: id, empresaId: empresa_id }));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar holerites');
    }
};
