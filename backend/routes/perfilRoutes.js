const express = require('express');
const router = express.Router();
const perfilController = require('../controllers/perfilController');
const verificarPerfil = require('../middlewares/roleMiddleware');
const validarEntrada = require('../middlewares/validarEntrada');
const { atualizarMeusDados, alterarSenha } = require('../schemas/perfilSchemas');

router.use(verificarPerfil(['Administrador', 'RH', 'Colaborador']));

router.get('/meus-dados', perfilController.obterMeuPerfil);
router.put('/meus-dados', validarEntrada({ body: atualizarMeusDados }), perfilController.atualizarMeusDados);
router.put('/alterar-senha', validarEntrada({ body: alterarSenha }), perfilController.alterarMinhaSenha);

module.exports = router;