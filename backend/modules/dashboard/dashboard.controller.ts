import type { Request, Response } from 'express';
import * as service from './dashboard.service.ts';
import { responderErro } from '../../shared/utils/erros.ts';

export const resumo = async (req: Request, res: Response) => {
    try {
        // SEGURANÇA: a empresa vem do token, nunca da requisição.
        if (!req.usuario) throw new Error('req.usuario ausente: a rota do dashboard precisa do authMiddleware.');
        res.json(await service.resumoDaEmpresa(req.usuario.empresa_id));
    } catch (erro) {
        responderErro(res, erro, 'Erro ao carregar o resumo do dashboard.');
    }
};
