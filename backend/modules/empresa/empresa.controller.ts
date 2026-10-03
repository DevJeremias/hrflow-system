// Camada HTTP dos dados da empresa: lê o que a requisição traz, chama o serviço e escreve a
// resposta. As regras ficam em empresa.service.ts.
import type { Request, Response } from 'express';
import * as service from './empresa.service.ts';
import { ErroDeEmpresa } from './empresa.erros.ts';
import type { TipoDeErro } from './empresa.erros.ts';
import type { DadosDaEmpresa } from './empresa.schemas.ts';
import { responderErro } from '../../shared/utils/erros.ts';

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { inexistente: 404, conflito: 409 };

const responderFalha = (res: Response, erro: unknown, mensagem500: string) => {
    if (erro instanceof ErroDeEmpresa) return res.status(STATUS_POR_TIPO[erro.tipo]).json(erro.corpo);
    return responderErro(res, erro, mensagem500);
};

// O authMiddleware, que roda antes de qualquer rota da empresa, preenche req.usuario.
const usuarioDe = (req: Request) => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota da empresa precisa do authMiddleware.');
    return req.usuario;
};

export const buscarEmpresa = async (req: Request, res: Response) => {
    try {
        // SEGURANÇA: a empresa vem do token, nunca da requisição.
        res.json(await service.buscarEmpresa(usuarioDe(req).empresa_id));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar os dados da empresa');
    }
};

export const atualizarEmpresa = async (req: Request, res: Response) => {
    try {
        if (!req.dadosValidados?.body) throw new Error('req.dadosValidados.body ausente: a rota precisa do validarEntrada.');
        const dados = req.dadosValidados.body as DadosDaEmpresa;
        res.json(await service.atualizarEmpresa({ empresaId: usuarioDe(req).empresa_id, dados }));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao salvar os dados da empresa');
    }
};
