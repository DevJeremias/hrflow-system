// Camada HTTP do perfil: lê o que a requisição traz, chama o serviço e escreve a resposta. As
// regras ficam em perfil.service.ts.
import type { Request, Response } from 'express';
import * as service from './perfil.service.ts';
import { ErroDePerfil } from './perfil.erros.ts';
import type { TipoDeErro } from './perfil.erros.ts';
import type { CorpoDeAlterarSenha, CorpoDeAtualizarMeusDados } from './perfil.schemas.ts';
import { responderErro } from '../../utils/erros.js';

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { invalido: 400, inexistente: 404 };

// Falha de regra vira a resposta que o serviço descreveu; qualquer outra passa por utils/erros.js,
// que traduz as falhas conhecidas do MySQL em 4xx/503 e devolve 500 com a mensagem do endpoint.
const responderFalha = (res: Response, erro: unknown, mensagem500: string) => {
    if (erro instanceof ErroDePerfil) return res.status(STATUS_POR_TIPO[erro.tipo]).json({ erro: erro.message });
    return responderErro(res, erro, mensagem500);
};

// O authMiddleware, que roda antes de qualquer rota do perfil, preenche req.usuario. A conta vem do
// token, nunca da requisição.
const usuarioDe = (req: Request) => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota do perfil precisa do authMiddleware.');
    return req.usuario;
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

export const atualizarMeusDados = async (req: Request, res: Response) => {
    try {
        const { id, funcionario_id, empresa_id } = usuarioDe(req);
        await service.atualizarMeusDados({
            usuarioId: id,
            funcionarioId: funcionario_id,
            empresaId: empresa_id,
            corpo: corpoDe<CorpoDeAtualizarMeusDados>(req),
        });
        res.json({ mensagem: 'Os seus dados foram atualizados com sucesso!' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao atualizar os dados.');
    }
};

export const alterarMinhaSenha = async (req: Request, res: Response) => {
    try {
        await service.alterarMinhaSenha(usuarioDe(req).id, corpoDe<CorpoDeAlterarSenha>(req));
        res.json({ mensagem: 'Senha atualizada com sucesso! Entre novamente.' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao trocar a senha.');
    }
};
