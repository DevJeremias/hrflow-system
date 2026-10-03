import type { NextFunction, Request, Response } from 'express';
import { responderErro } from '../utils/erros.ts';

// Último middleware da aplicação: o que escapar dos controllers e dos parsers de corpo sai
// como JSON em pt-BR, em vez da página HTML padrão do Express.
const tratarErros = (err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);

    const tipo = (err as { type?: string } | null)?.type;
    if (tipo === 'entity.too.large') {
        return res.status(413).json({ erro: 'O corpo da requisição excede o limite permitido.' });
    }
    if (tipo === 'entity.parse.failed' || tipo === 'encoding.unsupported' || tipo === 'charset.unsupported') {
        return res.status(400).json({ erro: 'Corpo da requisição inválido. Envie um JSON válido.' });
    }
    return responderErro(res, err, 'Erro interno do servidor.');
};

export default tratarErros;
