// backend/middlewares/roleMiddleware.js

const verificarPerfil = (perfisPermitidos) => {
    return (req, res, next) => {
        // req.usuario vem do authMiddleware que já rodou antes desse
        const perfilUsuario = req.usuario.perfil;

        if (!perfisPermitidos.includes(perfilUsuario)) {
            return res.status(403).json({ 
                erro: "Acesso negado. Seu perfil não tem permissão para esta ação." 
            });
        }

        next(); // Se o perfil estiver na lista permitida, a requisição continua
    };
};

module.exports = verificarPerfil;