// Executa os schemas zod de uma rota (params, body, query) antes do controller. Entrada
// inválida vira 400 com a primeira mensagem em `erro` (o campo que o front-end já exibe) e a
// lista completa em `detalhes`; a entrada validada e normalizada fica em req.dadosValidados.
import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

const PARTES = ['params', 'body', 'query'] as const;

export type SchemasDaRota = Partial<Record<(typeof PARTES)[number], z.ZodType>>;

const formatarIssues = (issues: z.core.$ZodIssue[]) => issues.map((issue) => ({
    campo: issue.path.join('.') || null,
    mensagem: issue.message,
}));

const validarEntrada = (schemas: SchemasDaRota) => (req: Request, res: Response, next: NextFunction) => {
    const dadosValidados: NonNullable<Request['dadosValidados']> = {};
    const detalhes: ReturnType<typeof formatarIssues> = [];

    for (const parte of PARTES) {
        const schema = schemas[parte];
        if (!schema) continue;
        const resultado = schema.safeParse(req[parte]);
        if (resultado.success) dadosValidados[parte] = resultado.data;
        else detalhes.push(...formatarIssues(resultado.error.issues));
    }

    if (detalhes.length > 0) return res.status(400).json({ erro: detalhes[0].mensagem, detalhes });

    req.dadosValidados = dadosValidados;
    next();
};

export default validarEntrada;
