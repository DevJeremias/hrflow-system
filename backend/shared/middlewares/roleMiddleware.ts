import type { NextFunction, Request, Response } from 'express';
import { perfilTem } from '../utils/permissoes.ts';
import type { Permissao } from '../utils/permissoes.ts';

const verificarPerfil = (perfisPermitidos: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // req.usuario vem do authMiddleware que já rodou antes desse
        if (!req.usuario) throw new Error('req.usuario ausente: a rota precisa do authMiddleware.');
        const perfilUsuario = req.usuario.perfil;

        if (!perfisPermitidos.includes(perfilUsuario)) {
            return res.status(403).json({ 
                erro: "Acesso negado. Seu perfil não tem permissão para esta ação." 
            });
        }

        next(); // Se o perfil estiver na lista permitida, a requisição continua
    };
};

// A rota pede a ação, e a matriz de shared/utils/permissoes.ts diz quais perfis a têm.
export const exigirPermissao = (permissao: Permissao) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.usuario) throw new Error('req.usuario ausente: a rota precisa do authMiddleware.');
        if (!perfilTem(req.usuario.perfil, permissao)) {
            return res.status(403).json({ erro: "Acesso negado. Seu perfil não tem permissão para esta ação." });
        }
        next();
    };
};

export default verificarPerfil;
