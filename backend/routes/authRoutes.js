const express = require('express');
const authController = require('../controllers/authController');
const { corpoJson, criarLimitadores, tratarErroDeCorpo } = require('../middlewares/limitesAuth');
const { validarLogin, validarRegistro } = require('../utils/validacaoAuth');

// Ordem em cada rota: limite por IP (barato, antes de ler o corpo), corpo pequeno,
// validação de entrada, limite por identidade e só então o controller.
const validar = (validador) => (req, res, next) => {
    const { erro, dados } = validador(req.body);
    if (erro) return res.status(400).json({ erro });
    req.dadosValidados = dados;
    next();
};

const criarRouter = (limites) => {
    const router = express.Router();
    const limitadores = criarLimitadores(limites);

    router.post('/registrar',
        limitadores.registroPorIp, corpoJson, validar(validarRegistro), limitadores.registroPorIdentidade,
        authController.registrarConta);
    router.post('/login',
        limitadores.loginPorIp, corpoJson, validar(validarLogin), limitadores.loginPorIdentidade,
        authController.login);

    router.use(tratarErroDeCorpo);
    return router;
};

module.exports = criarRouter();
module.exports.criarRouter = criarRouter;
