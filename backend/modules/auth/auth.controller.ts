// Camada HTTP da autenticação: lê o que a requisição traz, chama o serviço e escreve a resposta. As
// regras ficam em auth.service.ts.
import type { Request, Response } from 'express';
import * as service from './auth.service.ts';
import { ErroDeAuth } from './auth.erros.ts';
import type { TipoDeErro } from './auth.erros.ts';
import type { DadosDeEsqueciSenha, DadosDeLogin, DadosDeRedefinicao, DadosDeRegistro } from './auth.schemas.ts';
import { encerrarSessao, iniciarSessao } from './auth.sessao.ts';
import { responderErro } from '../../shared/utils/erros.ts';

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { naoAutenticado: 401, proibido: 403, conflito: 409, invalido: 400, naoDisponivel: 501 };

// Falha de regra vira a resposta que o serviço descreveu; falha do banco vira 4xx/503 (shared/utils/erros.ts)
// e qualquer outra é 500 com a mensagem do endpoint.
const responderFalha = (res: Response, erro: unknown, mensagem500: string) => {
    if (erro instanceof ErroDeAuth) return res.status(STATUS_POR_TIPO[erro.tipo]).json(erro.corpo);
    return responderErro(res, erro, mensagem500);
};

// O authMiddleware, que roda antes da rota da sessão, preenche req.usuario.
const usuarioDe = (req: Request) => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota da sessão precisa do authMiddleware.');
    return req.usuario;
};

// O validador da rota já validou e normalizou o corpo; os tipos vêm de auth.schemas.ts.
const corpoDe = <T>(req: Request): T => {
    if (!req.dadosValidados?.body) throw new Error('req.dadosValidados.body ausente: a rota precisa validar o corpo.');
    return req.dadosValidados.body as T;
};

export const registrarConta = async (req: Request, res: Response) => {
    try {
        await service.registrarConta(corpoDe<DadosDeRegistro>(req));
        res.status(201).json({ mensagem: 'Conta criada com sucesso!' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao criar conta.');
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { token, perfil, nome, senhaProvisoria } = await service.login(corpoDe<DadosDeLogin>(req));
        iniciarSessao(req, res, token);
        res.json({ perfil, nome, senhaProvisoria });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao processar login.');
    }
};

export const esqueciSenha = async (req: Request, res: Response) => {
    try {
        await service.solicitarRedefinicao(corpoDe<DadosDeEsqueciSenha>(req));
        res.json({ mensagem: 'Se o e-mail estiver cadastrado, enviamos as instruções para redefinir a senha.' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao pedir a redefinição de senha.');
    }
};

export const redefinirSenha = async (req: Request, res: Response) => {
    try {
        await service.redefinirSenha(corpoDe<DadosDeRedefinicao>(req));
        res.json({ mensagem: 'Senha redefinida. Entre com a nova senha.' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao redefinir a senha.');
    }
};

// Público de propósito: quem tem a sessão expirada também precisa conseguir limpar os cookies.
export const logout = (req: Request, res: Response) => {
    encerrarSessao(req, res);
    res.status(204).end();
};

export const sessao = async (req: Request, res: Response) => {
    try {
        res.json(await service.identidadeDaSessao(usuarioDe(req).id));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao consultar a sessão.');
    }
};
