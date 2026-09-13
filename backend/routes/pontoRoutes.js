const express = require('express');
const router = express.Router();
const pontoController = require('../controllers/pontoController');
const verificarPerfil = require('../middlewares/roleMiddleware');
const verificarAcessoFuncionario = require('../middlewares/employeeAccessMiddleware');

router.post('/registrar', pontoController.registrarPonto);
router.get('/hoje/:funcionarioId', verificarAcessoFuncionario, pontoController.listarPontosHoje);
router.get('/historico/:funcionarioId', verificarAcessoFuncionario, pontoController.listarHistorico);
router.get('/totais/:funcionarioId', verificarAcessoFuncionario, pontoController.listarTotais);
router.get('/', verificarPerfil(['Administrador', 'RH']), pontoController.listarPontos);

module.exports = router;