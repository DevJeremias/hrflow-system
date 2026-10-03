// Camada HTTP das contas de acesso: lê o que a requisição traz, chama o serviço e escreve a
// resposta. As regras ficam em usuarios.service.ts.
import type { Request, Response } from 'express';
import * as service from './usuarios.service.ts';
import { ErroDeUsuario } from './usuarios.erros.ts';
import type { TipoDeErro } from './usuarios.erros.ts';
import type { CorpoDaEdicao, CorpoDoCadastro, IdDaRota } from './usuarios.schemas.ts';
import { autoriaDe } from '../../shared/utils/auditar.ts';
import { responderErro } from '../../shared/utils/erros.ts';
import { enviarPagina } from '../../shared/utils/paginacao.ts';

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { invalido: 400, inexistente: 404, proibido: 403, conflito: 409 };

// Falha de regra vira a resposta que o serviço descreveu; qualquer outra passa por responderErro,
// que converte falhas conhecidas do MySQL em 4xx/503 e devolve 500 com a mensagem do endpoint.
const responderFalha = (res: Response, erro: unknown, mensagem500: string) => {
    if (erro instanceof ErroDeUsuario) return res.status(STATUS_POR_TIPO[erro.tipo]).json(erro.corpo);
    return responderErro(res, erro, mensagem500);
};

// O authMiddleware, que roda antes de qualquer rota de usuários, preenche req.usuario; a empresa vem do token.
const usuarioDe = (req: Request) => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota de usuários precisa do authMiddleware.');
    return req.usuario;
};

// O validarEntrada da rota já validou e normalizou a entrada; os tipos vêm de usuarios.schemas.ts.
const entradaDe = <T>(req: Request, parte: 'params' | 'body' | 'query'): T => {
    if (!req.dadosValidados?.[parte]) throw new Error(`req.dadosValidados.${parte} ausente: a rota precisa do validarEntrada.`);
    return req.dadosValidados[parte] as T;
};

export const listarUsuarios = async (req: Request, res: Response) => {
    try {
        const { usuarios, total } = await service.listarUsuarios(usuarioDe(req).empresa_id, entradaDe<{ pagina: number; limite: number }>(req, 'query'));
        enviarPagina(res, usuarios, total);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar usuários.');
    }
};

export const criarUsuario = async (req: Request, res: Response) => {
    try {
        res.status(201).json(await service.criarUsuario(usuarioDe(req).empresa_id, autoriaDe(req), entradaDe<CorpoDoCadastro>(req, 'body')));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao criar o usuário.');
    }
};

export const atualizarUsuario = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaRota>(req, 'params');
        res.json(await service.atualizarUsuario(usuarioDe(req), autoriaDe(req), id, entradaDe<CorpoDaEdicao>(req, 'body')));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao alterar o usuário.');
    }
};
