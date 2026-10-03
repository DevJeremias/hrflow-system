// Camada HTTP de funcionários: lê o que a requisição traz, chama o serviço e escreve a resposta.
// As regras ficam em funcionarios.service.ts.
import type { Request, Response } from 'express';
import * as service from './funcionarios.service.ts';
import type { Ator } from './funcionarios.service.ts';
import { ErroDeFuncionario } from './funcionarios.erros.ts';
import type { TipoDeErro } from './funcionarios.erros.ts';
import type { CorpoDaEdicao, CorpoDoCadastro, CorpoDoDependente, CorpoDoStatus, DependenteDaRota, IdDaRota, ConsultaDeFuncionarios } from './funcionarios.schemas.ts';
import { responderErro } from '../../shared/utils/erros.ts';
import { enviarPagina } from '../../shared/utils/paginacao.ts';

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { invalido: 400, proibido: 403, inexistente: 404, conflito: 409 };

// Falha de regra vira a resposta que o serviço descreveu; qualquer outra passa por responderErro,
// que converte falhas conhecidas do MySQL em 4xx/503 e devolve 500 com a mensagem do endpoint.
const responderFalha = (res: Response, erro: unknown, mensagem500: string) => {
    if (erro instanceof ErroDeFuncionario) return res.status(STATUS_POR_TIPO[erro.tipo]).json(erro.corpo);
    return responderErro(res, erro, mensagem500);
};

// O authMiddleware, que roda antes de qualquer rota de funcionários, preenche req.usuario.
const empresaDe = (req: Request): number => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota de funcionários precisa do authMiddleware.');
    return req.usuario.empresa_id;
};

// Quem opera a ação, como o token o descreve.
const atorDe = (req: Request): Ator => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota de funcionários precisa do authMiddleware.');
    return { perfil: req.usuario.perfil, funcionarioId: req.usuario.funcionario_id };
};

// O validarEntrada da rota já validou e normalizou a entrada; os tipos vêm de funcionarios.schemas.ts.
const entradaDe = <T>(req: Request, parte: 'params' | 'body' | 'query'): T => {
    if (!req.dadosValidados?.[parte]) throw new Error(`req.dadosValidados.${parte} ausente: a rota precisa do validarEntrada.`);
    return req.dadosValidados[parte] as T;
};

export const listarFuncionarios = async (req: Request, res: Response) => {
    try {
        const { funcionarios, total } = await service.listarFuncionarios(empresaDe(req), entradaDe<ConsultaDeFuncionarios>(req, 'query'));
        enviarPagina(res, funcionarios, total);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar funcionários.');
    }
};

export const criarFuncionario = async (req: Request, res: Response) => {
    try {
        await service.criarFuncionario(empresaDe(req), entradaDe<CorpoDoCadastro>(req, 'body'));
        res.status(201).json({ mensagem: 'Colaborador e credenciais de acesso criados com sucesso!' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao processar o cadastro.');
    }
};

export const atualizarFuncionario = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaRota>(req, 'params');
        await service.atualizarFuncionario(empresaDe(req), id, atorDe(req), entradaDe<CorpoDaEdicao>(req, 'body'));
        res.json({ mensagem: 'Funcionário atualizado com sucesso!' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao modificar o funcionário.');
    }
};

export const deletarFuncionario = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaRota>(req, 'params');
        await service.deletarFuncionario(empresaDe(req), id, atorDe(req));
        res.json({ mensagem: 'Funcionário removido com sucesso!' });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao remover o funcionário.');
    }
};

export const alterarStatus = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaRota>(req, 'params');
        const situacao = await service.alterarStatus(empresaDe(req), id, atorDe(req), entradaDe<CorpoDoStatus>(req, 'body'));
        res.json({ mensagem: 'Situação do colaborador atualizada com sucesso!', ...situacao });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao alterar a situação do colaborador.');
    }
};

// A senha provisória só existe nesta resposta: nada a guarda em claro e o navegador não deve cacheá-la.
export const redefinirSenha = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaRota>(req, 'params');
        const senhaProvisoria = await service.redefinirSenha(empresaDe(req), id, atorDe(req));
        res.set('Cache-Control', 'no-store').json({
            mensagem: 'Senha redefinida. Entregue a senha provisória ao colaborador: ela não será exibida de novo.',
            senhaProvisoria,
        });
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao redefinir a senha do colaborador.');
    }
};

export const listarDependentes = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaRota>(req, 'params');
        res.json(await service.listarDependentes(empresaDe(req), id));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao buscar os dependentes.');
    }
};

export const adicionarDependente = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaRota>(req, 'params');
        res.status(201).json(await service.adicionarDependente(empresaDe(req), id, atorDe(req), entradaDe<CorpoDoDependente>(req, 'body')));
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao cadastrar o dependente.');
    }
};

export const removerDependente = async (req: Request, res: Response) => {
    try {
        const { id, dependenteId } = entradaDe<DependenteDaRota>(req, 'params');
        await service.removerDependente(empresaDe(req), id, dependenteId, atorDe(req));
        res.status(204).end();
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao excluir o dependente.');
    }
};
