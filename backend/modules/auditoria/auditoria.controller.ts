// Camada HTTP da auditoria: lê o que a requisição traz, chama o serviço e escreve a resposta. As regras
// ficam em auditoria.service.ts.
import type { Request, Response } from 'express';
import * as service from './auditoria.service.ts';
import type { ConsultaDeAuditoria } from './auditoria.schemas.ts';
import { responderErro } from '../../shared/utils/erros.ts';
import { enviarPagina } from '../../shared/utils/paginacao.ts';

export const listarAuditoria = async (req: Request, res: Response) => {
    try {
        if (!req.usuario) throw new Error('req.usuario ausente: a rota de auditoria precisa do authMiddleware.');
        if (!req.dadosValidados?.query) throw new Error('req.dadosValidados.query ausente: a rota precisa do validarEntrada.');
        const { registros, total } = await service.listarAuditoria(req.usuario.empresa_id, req.dadosValidados.query as ConsultaDeAuditoria);
        enviarPagina(res, registros, total);
    } catch (erro) {
        responderErro(res, erro, 'Erro ao buscar a trilha de auditoria.');
    }
};
