// Camada HTTP dos relatórios: lê o que a requisição traz, chama o serviço e escreve a resposta no
// formato pedido (JSON para as telas, CSV e PDF para a exportação). As regras ficam em relatorios.service.ts.
import type { Request, Response } from 'express';
import * as service from './relatorios.service.ts';
import type { Relatorio } from './relatorios.service.ts';
import { ErroDeRelatorio } from './relatorios.erros.ts';
import type { TipoDeErro } from './relatorios.erros.ts';
import { gerarCsv } from './relatorios.csv.ts';
import { gerarPdf } from './relatorios.pdf.ts';
import type { ConsultaDeAbsenteismo, ConsultaDeAniversariantes, ConsultaDeCusto, ConsultaDeHeadcount, Formato } from './relatorios.schemas.ts';
import { responderErro } from '../../shared/utils/erros.ts';

const STATUS_POR_TIPO: Record<TipoDeErro, number> = { invalido: 400, inexistente: 404 };

const responderFalha = (res: Response, erro: unknown, mensagem500: string) => {
    if (erro instanceof ErroDeRelatorio) return res.status(STATUS_POR_TIPO[erro.tipo]).json(erro.corpo);
    return responderErro(res, erro, mensagem500);
};

// O authMiddleware, que roda antes de qualquer rota dos relatórios, preenche req.usuario.
const empresaDe = (req: Request): number => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota dos relatórios precisa do authMiddleware.');
    // SEGURANÇA: a empresa vem do token, nunca da requisição.
    return req.usuario.empresa_id;
};

const consultaDe = <T>(req: Request): T => {
    if (!req.dadosValidados?.query) throw new Error('req.dadosValidados.query ausente: a rota precisa do validarEntrada.');
    return req.dadosValidados.query as T;
};

// Números de uma empresa que não devem ficar em cache de proxy nem no disco compartilhado.
const responder = async <T>(res: Response, relatorio: Relatorio<T>, formato: Formato) => {
    res.set('Cache-Control', 'no-store');
    if (formato === 'json') return res.json(relatorio.dados);
    if (formato === 'csv') {
        res.type('text/csv; charset=utf-8').attachment(`${relatorio.tabela.arquivo}.csv`);
        return res.send(gerarCsv(relatorio.tabela));
    }
    res.type('application/pdf').attachment(`${relatorio.tabela.arquivo}.pdf`);
    return res.send(await gerarPdf(relatorio.tabela));
};

export const headcount = async (req: Request, res: Response) => {
    try {
        const consulta = consultaDe<ConsultaDeHeadcount>(req);
        await responder(res, await service.headcount({ empresaId: empresaDe(req), consulta }), consulta.formato);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao gerar o relatório de headcount.');
    }
};

export const aniversariantes = async (req: Request, res: Response) => {
    try {
        const consulta = consultaDe<ConsultaDeAniversariantes>(req);
        await responder(res, await service.aniversariantes({ empresaId: empresaDe(req), consulta }), consulta.formato);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao gerar o relatório de aniversariantes.');
    }
};

export const custoPorDepartamento = async (req: Request, res: Response) => {
    try {
        const consulta = consultaDe<ConsultaDeCusto>(req);
        await responder(res, await service.custoPorDepartamento({ empresaId: empresaDe(req), consulta }), consulta.formato);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao gerar o relatório de custo por departamento.');
    }
};

export const absenteismo = async (req: Request, res: Response) => {
    try {
        const consulta = consultaDe<ConsultaDeAbsenteismo>(req);
        await responder(res, await service.absenteismo({ empresaId: empresaDe(req), consulta }), consulta.formato);
    } catch (erro) {
        responderFalha(res, erro, 'Erro ao gerar o relatório de absenteísmo.');
    }
};
