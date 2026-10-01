const verificarAcessoFuncionario = (req, res, next) => {
    const perfil = req.usuario.perfil;
    const funcionarioIdSolicitado = String(req.params.funcionarioId);
    const funcionarioIdUsuario = req.usuario.funcionario_id;

    if (perfil === 'Administrador' || perfil === 'RH') {
        return next();
    }

    if (!funcionarioIdUsuario || funcionarioIdSolicitado !== String(funcionarioIdUsuario)) {
        return res.status(403).json({
            erro: "Acesso negado. Seu perfil não tem permissão para esta ação."
        });
    }

    next();
};

module.exports = verificarAcessoFuncionario;
