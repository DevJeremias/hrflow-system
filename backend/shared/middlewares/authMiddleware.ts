import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2/promise';
import jwtSecret from '../config/jwtSecret.ts';
import db from '../db/pool.ts';
import { responderErro } from '../utils/erros.ts';
// Direto do arquivo, não do index do módulo: o index monta o router de auth, que importa este middleware.
import { lerTokenDaSessao, csrfValido, encerrarSessao } from '../../modules/auth/auth.sessao.ts';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

interface SessaoNoBanco extends RowDataPacket {
    sessao_versao: number;
    funcionario_status: string | null;
}

export default async (req: Request, res: Response, next: NextFunction) => {
    // 1. O crachá vem no cookie HttpOnly da sessão (modules/auth/auth.sessao.ts)
    const token = lerTokenDaSessao(req);

    if (!token) {
        return res.status(401).json({ erro: 'Acesso negado. Nenhuma sessão foi encontrada.' });
    }

    let verified: NonNullable<Request['usuario']>;
    try {
        // 2. Valida o crachá usando a chave secreta validada na subida
        verified = jwt.verify(token, jwtSecret) as NonNullable<Request['usuario']>;
    } catch (erro) {
        // Se cair aqui, é porque o crachá expirou ou foi corrompido
        console.error("Erro na verificação do Token:", (erro as Error).message);
        encerrarSessao(req, res);
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }

    // 3. O cookie vai sozinho em qualquer requisição, inclusive as disparadas por outro site:
    // quem muda estado precisa provar que veio do front-end devolvendo o token CSRF.
    if (!METODOS_SEGUROS.has(req.method) && !csrfValido(req, token)) {
        return res.status(403).json({ erro: 'Requisição recusada: token CSRF ausente ou inválido.' });
    }

    try {
        // 4. Assinatura válida não basta: o usuário precisa continuar existindo, o funcionário
        // vinculado não pode estar inativo e a versão da sessão tem que ser a do token.
        const [linhas] = await db.query<SessaoNoBanco[]>(
            `SELECT u.sessao_versao, f.status AS funcionario_status
             FROM usuarios u
             LEFT JOIN funcionarios f ON f.id = u.funcionario_id AND f.empresa_id = u.empresa_id
             WHERE u.id = ?`,
            [verified.id]
        );
        const atual = linhas[0];
        if (!atual || atual.sessao_versao !== verified.sv || atual.funcionario_status === 'Inativo') {
            encerrarSessao(req, res);
            return res.status(401).json({ erro: 'Sessão encerrada. Faça login novamente.' });
        }

        // 5. Se for válido, guarda os dados do utilizador e deixa passar para a rota
        req.usuario = verified;
        next();
    } catch (erro) {
        // Banco fora do ar ou pool cheio é 503 com Retry-After, não um 500 sem saída.
        return responderErro(res, erro, 'Erro ao validar a sessão.');
    }
};
