import type { NextFunction, Request, Response } from 'express';

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

export default verificarPerfil;
