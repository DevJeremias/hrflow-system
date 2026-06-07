const express = require('express');
const router = express.Router();
const perfilController = require('../controllers/perfilController');
const verificarPerfil = require('../middlewares/roleMiddleware');

router.use(verificarPerfil(['Administrador', 'RH', 'Colaborador']));

router.get('/meus-dados', perfilController.obterMeuPerfil);
router.put('/meus-dados', perfilController.atualizarMeusDados);
router.put('/alterar-senha', perfilController.alterarMinhaSenha);

module.exports = router;