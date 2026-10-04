// Camada HTTP das notificações: lê o que a requisição traz, chama o serviço e escreve a resposta. As
// regras ficam em notificacoes.service.ts.
import type { Request, Response } from 'express';
import * as service from './notificacoes.service.ts';
import { ErroDeNotificacao } from './notificacoes.erros.ts';
import type { TipoDeErro } from './notificacoes.erros.ts';
import type { ConsultaDeNotificacoes, IdDaNotificacao } from './notificacoes.schemas.ts';
import { responderErro } from '../../shared/utils/erros.ts';

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { inexistente: 404 };

const responderFalha = (res: Response, erro: unknown, mensagem500: string) => {
    if (erro instanceof ErroDeNotificacao) return res.status(STATUS_POR_TIPO[erro.tipo]).json(erro.corpo);
    return responderErro(res, erro, mensagem500);
};

// O authMiddleware, que roda antes de qualquer rota das notificações, preenche req.usuario.
const donoDe = (req: Request) => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota das notificações precisa do authMiddleware.');
    // SEGURANÇA: o usuário e a empresa vêm do token, nunca da requisição.
    return { usuarioId: req.usuario.id, empresaId: req.usuario.empresa_id };
};

const entradaDe = <T>(req: Request, parte: 'params' | 'query'): T => {
    if (!req.dadosValidados?.[parte]) throw new Error(`req.dadosValidados.${parte} ausente: a rota precisa do validarEntrada.`);
    return req.dadosValidados[parte] as T;
};

export const listarNotificacoes = async (req: Request, res: Response) => {
    try {
        const { limite } = entradaDe<ConsultaDeNotificacoes>(req, 'query');
        res.json(await service.listarNotificacoes({ ...donoDe(req), limite }));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar as notificações.');
    }
};

export const marcarComoLida = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaNotificacao>(req, 'params');
        res.json(await service.marcarComoLida({ id, ...donoDe(req) }));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao marcar a notificação como lida.');
    }
};

export const marcarTodasComoLidas = async (req: Request, res: Response) => {
    try {
        res.json(await service.marcarTodasComoLidas(donoDe(req)));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao marcar as notificações como lidas.');
    }
};
