// Camada HTTP das ausências: lê o que a requisição traz, chama o serviço e escreve a resposta. As
// regras ficam em ausencias.service.ts.
import type { Request, Response } from 'express';
import * as service from './ausencias.service.ts';
import { ErroDeAusencia } from './ausencias.erros.ts';
import type { TipoDeErro } from './ausencias.erros.ts';
import type { ColaboradorDoSaldo, ConsultaDeAusencias, CorpoDaSolicitacao, DecisaoRecebida, IdDaAusencia } from './ausencias.schemas.ts';
import { responderErro } from '../../shared/utils/erros.ts';
import { enviarPagina } from '../../shared/utils/paginacao.ts';

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { proibido: 403, invalido: 400, inexistente: 404, conflito: 409 };

// Falha de regra vira a resposta que o serviço descreveu; falha do banco vira 4xx/503 (shared/utils/erros.ts)
// e qualquer outra é 500 com a mensagem do endpoint.
const responderFalha = (res: Response, erro: unknown, mensagem500: string) => {
    if (erro instanceof ErroDeAusencia) return res.status(STATUS_POR_TIPO[erro.tipo]).json(erro.corpo);
    return responderErro(res, erro, mensagem500);
};

// O authMiddleware, que roda antes de qualquer rota de ausências, preenche req.usuario.
const usuarioDe = (req: Request) => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota de ausências precisa do authMiddleware.');
    return req.usuario;
};

const atorDe = (req: Request): service.Ator => ({ perfil: usuarioDe(req).perfil, funcionarioId: usuarioDe(req).funcionario_id });

// O validarEntrada da rota já validou e normalizou a entrada; os tipos vêm de ausencias.schemas.ts.
const entradaDe = <T>(req: Request, parte: 'params' | 'body' | 'query'): T => {
    if (!req.dadosValidados?.[parte]) throw new Error(`req.dadosValidados.${parte} ausente: a rota precisa do validarEntrada.`);
    return req.dadosValidados[parte] as T;
};

export const solicitar = async (req: Request, res: Response) => {
    try {
        // SEGURANÇA: empresa e colaborador vêm do token criptografado, não do req.body
        const { empresa_id, funcionario_id } = usuarioDe(req);
        const ausencia = await service.solicitar({ empresaId: empresa_id, funcionarioId: funcionario_id, corpo: entradaDe<CorpoDaSolicitacao>(req, 'body') });
        res.status(201).json(ausencia);
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao salvar a solicitação.');
    }
};

export const listarMinhas = async (req: Request, res: Response) => {
    try {
        const { empresa_id, funcionario_id } = usuarioDe(req);
        res.json(await service.listarMinhas({ empresaId: empresa_id, funcionarioId: funcionario_id }));
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao buscar as solicitações.');
    }
};

export const listarDaEmpresa = async (req: Request, res: Response) => {
    try {
        const { ausencias, total } = await service.listarDaEmpresa({
            empresaId: usuarioDe(req).empresa_id,
            ator: atorDe(req),
            consulta: entradaDe<ConsultaDeAusencias>(req, 'query'),
        });
        enviarPagina(res, ausencias, total);
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao buscar as solicitações.');
    }
};

export const decidir = async (req: Request, res: Response) => {
    try {
        const { empresa_id, id: usuarioId } = usuarioDe(req);
        const { id } = entradaDe<IdDaAusencia>(req, 'params');
        const { status, resposta } = entradaDe<DecisaoRecebida>(req, 'body');
        res.json(await service.decidir({ empresaId: empresa_id, id, status, resposta, usuarioId, ator: atorDe(req) }));
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao decidir a solicitação.');
    }
};

export const saldo = async (req: Request, res: Response) => {
    try {
        const { funcionarioId } = entradaDe<ColaboradorDoSaldo>(req, 'params');
        res.json(await service.saldoDoColaborador({ empresaId: usuarioDe(req).empresa_id, funcionarioId }));
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao calcular o saldo de férias.');
    }
};

export const baixarAnexo = async (req: Request, res: Response) => {
    try {
        const { id } = entradaDe<IdDaAusencia>(req, 'params');
        const anexo = await service.anexoDaAusencia({ empresaId: usuarioDe(req).empresa_id, id, ator: atorDe(req) });
        // O tipo vem da lista de tipos aceitos no envio (PDF, JPEG, PNG), e o nosniff impede o navegador de reinterpretá-lo.
        res.set({
            'Content-Type': anexo.tipo,
            'Content-Length': String(anexo.conteudo.length),
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(anexo.nome)}`,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'private, no-store',
        });
        res.send(anexo.conteudo);
    } catch (erro) {
        responderFalha(res, erro, 'Erro interno ao baixar o anexo.');
    }
};
