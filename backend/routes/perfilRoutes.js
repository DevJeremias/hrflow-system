const express = require('express');
const perfilController = require('../controllers/perfilController');
const verificarPerfil = require('../middlewares/roleMiddleware');
const validarEntrada = require('../middlewares/validarEntrada');
const { criarLimitadores } = require('../middlewares/limitesAuth');
const { atualizarMeusDados, alterarSenha } = require('../schemas/perfilSchemas');

const criarRouter = (limites) => {
    const router = express.Router();
    const limitadores = criarLimitadores(limites);

    router.use(verificarPerfil(['Administrador', 'RH', 'Colaborador']));

    router.get('/meus-dados', perfilController.obterMeuPerfil);
    router.put('/meus-dados', validarEntrada({ body: atualizarMeusDados }), perfilController.atualizarMeusDados);
    router.put('/alterar-senha',
        validarEntrada({ body: alterarSenha }), limitadores.alterarSenhaPorUsuario,
        perfilController.alterarMinhaSenha);

    return router;
};

module.exports = criarRouter();
module.exports.criarRouter = criarRouter;
