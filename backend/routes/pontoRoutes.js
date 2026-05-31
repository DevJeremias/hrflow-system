const express = require('express');
const router = express.Router();
const pontoController = require('../controllers/pontoController');

router.post('/registrar', pontoController.registrarPonto);
router.get('/hoje/:funcionarioId', pontoController.listarPontosHoje);
router.get('/historico/:funcionarioId', pontoController.listarHistorico);
router.get('/totais/:funcionarioId', pontoController.listarTotais);
router.get('/', pontoController.listarPontos);

module.exports = router;