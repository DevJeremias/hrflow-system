// Camada HTTP da folha: lê o que a requisição traz, chama o serviço e escreve a resposta. As regras
// ficam em folha.service.ts.
import type { Request, Response } from 'express';
import * as service from './folha.service.ts';
import { ErroDeFolha } from './folha.erros.ts';
import type { TipoDeErro } from './folha.erros.ts';
import type { ConsultaDaFolha } from './folha.schemas.ts';
import { responderErro } from '../../shared/utils/erros.js';
import { enviarPagina } from '../../shared/utils/paginacao.js';

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { inexistente: 404 };

// Falha de regra vira a resposta que o serviço descreveu; qualquer outra passa por responderErro
// (utils/erros.js), que traduz falhas conhecidas do MySQL em 4xx/503 e devolve 500 com a mensagem
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

// O validarEntrada da rota já validou e normalizou a entrada; o tipo vem de folha.schemas.ts.
const consultaDe = (req: Request): ConsultaDaFolha => {
    if (!req.dadosValidados?.query) throw new Error('req.dadosValidados.query ausente: a rota precisa do validarEntrada.');
    return req.dadosValidados.query as ConsultaDaFolha;
};

export const processarFolha = async (req: Request, res: Response) => {
    try {
        // SEGURANÇA: a empresa vem do token, nunca da requisição.
        const { holerites, total } = await service.processarFolha({ empresaId: usuarioDe(req).empresa_id, consulta: consultaDe(req) });
        enviarPagina(res, holerites, total);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao processar folha de pagamento');
    }
};

export const meuHolerite = async (req: Request, res: Response) => {
    try {
        const { id, empresa_id } = usuarioDe(req);
        res.json(await service.meuHolerite({ usuarioId: id, empresaId: empresa_id }));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar holerite');
    }
};
