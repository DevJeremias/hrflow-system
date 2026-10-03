import type { NextFunction, Request, Response } from 'express';

// Rotas com :funcionarioId: Administrador e RH enxergam qualquer colaborador da empresa; os demais
// perfis só o próprio vínculo. Roda depois do authMiddleware, que preenche req.usuario.
export const verificarAcessoFuncionario = (req: Request<{ funcionarioId: string }>, res: Response, next: NextFunction) => {
    if (!req.usuario) throw new Error('req.usuario ausente: a rota precisa do authMiddleware.');
    const { perfil, funcionario_id: funcionarioIdDoUsuario } = req.usuario;

    if (perfil === 'Administrador' || perfil === 'RH') {
        return next();
    }

    if (!funcionarioIdDoUsuario || String(req.params.funcionarioId) !== String(funcionarioIdDoUsuario)) {
        return res.status(403).json({
            erro: 'Acesso negado. Seu perfil não tem permissão para esta ação.',
        });
    }

    next();
};
