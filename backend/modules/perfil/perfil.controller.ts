// Camada HTTP do perfil: lê o que a requisição traz, chama o serviço e escreve a resposta. As
// regras ficam em perfil.service.ts.
import type { Request, Response } from 'express';
import * as service from './perfil.service.ts';
import { ErroDePerfil } from './perfil.erros.ts';
import type { TipoDeErro } from './perfil.erros.ts';
import { ErroDeSolicitacao } from '../solicitacoes/index.ts';
import type { CorpoDeAlterarSenha, CorpoDeAtualizarMeusDados } from './perfil.schemas.ts';
import { autoriaDe } from '../../shared/utils/auditar.ts';
import { responderErro } from '../../shared/utils/erros.ts';
import { TIPO_DA_MINIATURA } from './perfil.miniatura.ts';

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { invalido: 400, proibido: 403, inexistente: 404 };
const STATUS_DA_SOLICITACAO = { invalido: 400, proibido: 403, inexistente: 404, conflito: 409 };

// Falha de regra vira a resposta que o serviço descreveu; qualquer outra passa por shared/utils/erros.ts,
// que traduz as falhas conhecidas do MySQL em 4xx/503 e devolve 500 com a mensagem do endpoint.
const responderFalha = (res: Response, erro: unknown, mensagem500: string) => {
    if (erro instanceof ErroDePerfil) return res.status(STATUS_POR_TIPO[erro.tipo]).json(erro.corpo);
    if (erro instanceof ErroDeSolicitacao) return res.status(STATUS_DA_SOLICITACAO[erro.tipo]).json(erro.corpo);
    return responderErro(res, erro, mensagem500);
};

// O authMiddleware, que roda antes de qualquer rota do perfil, preenche req.usuario. A conta vem do
// token, nunca da requisição.
const usuarioDe = (req: Request) => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota do perfil precisa do authMiddleware.');
    return req.usuario;
};

const operadorDe = (req: Request): service.Operador => {
    const { id, empresa_id, perfil, funcionario_id } = usuarioDe(req);
    return { id, empresa_id, perfil, funcionario_id };
};

// O validarEntrada da rota já validou e normalizou o corpo; o tipo vem de perfil.schemas.ts.
const corpoDe = <T>(req: Request): T => {
    if (!req.dadosValidados?.body) throw new Error('req.dadosValidados.body ausente: a rota precisa do validarEntrada.');
    return req.dadosValidados.body as T;
};

export const obterMeuPerfil = async (req: Request, res: Response) => {
    try {
        const { id, empresa_id } = usuarioDe(req);
        res.json(await service.obterMeuPerfil(id, empresa_id));
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao buscar perfil.');
    }
};

// A URL leva ?v= (muda a cada upload), então a resposta pode ser reaproveitada; o no-cache obriga a
// revalidar com If-None-Match, e o ETag que o Express calcula devolve 304 quando nada mudou.
export const obterMeuAvatar = async (req: Request, res: Response) => {
    try {
        const { id, empresa_id } = usuarioDe(req);
        const miniatura = await service.obterMeuAvatar(id, empresa_id);
        res.set({ 'Content-Type': TIPO_DA_MINIATURA, 'Cache-Control': 'private, no-cache' });
        res.send(miniatura);
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao buscar o avatar.');
    }
};

export const atualizarMeusDados = async (req: Request, res: Response) => {
    try {
        const { sessaoEncerrada } = await service.atualizarMeusDados({
            operador: operadorDe(req),
            autoria: autoriaDe(req),
            corpo: corpoDe<CorpoDeAtualizarMeusDados>(req),
        });
        res.json({
            mensagem: sessaoEncerrada ? 'Dados atualizados. Você trocou o e-mail de login: entre novamente.' : 'Os seus dados foram atualizados com sucesso!',
            sessaoEncerrada,
        });
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao atualizar os dados.');
    }
};

export const alterarMinhaSenha = async (req: Request, res: Response) => {
    try {
        await service.alterarMinhaSenha(operadorDe(req), autoriaDe(req), corpoDe<CorpoDeAlterarSenha>(req));
        res.json({ mensagem: 'Senha atualizada com sucesso! Entre novamente.' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao trocar a senha.');
    }
};
