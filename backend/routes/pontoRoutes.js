const express = require('express');
const router = express.Router();
const pontoController = require('../controllers/pontoController');
const verificarPerfil = require('../middlewares/roleMiddleware');
const verificarAcessoFuncionario = require('../middlewares/employeeAccessMiddleware');
const validarEntrada = require('../middlewares/validarEntrada');
const { diaDaJustificativa, enviarJustificativa, consultarJustificativas } = require('../schemas/pontoSchemas');

router.post('/registrar', pontoController.registrarPonto);
router.get('/hoje/:funcionarioId', verificarAcessoFuncionario, pontoController.listarPontosHoje);
router.get('/historico/:funcionarioId', verificarAcessoFuncionario, pontoController.listarHistorico);
router.get('/totais/:funcionarioId', verificarAcessoFuncionario, pontoController.listarTotais);
router.get('/', verificarPerfil(['Administrador', 'RH']), pontoController.listarPontos);
router.put('/justificativa/:data', validarEntrada({ params: diaDaJustificativa, body: enviarJustificativa }), pontoController.enviarJustificativa);
router.get('/justificativas', verificarPerfil(['Administrador', 'RH']), validarEntrada({ query: consultarJustificativas }), pontoController.listarJustificativas);

module.exports = router;