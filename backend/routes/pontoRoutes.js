const express = require('express');
const router = express.Router();
const pontoController = require('../controllers/pontoController');

// Rota POST para bater o ponto (Qualquer usuário autenticado pode acessar)
router.post('/', pontoController.registrarPonto);

// Rota GET para listar os pontos (Tanto o colaborador quanto o RH vão precisar disso)
router.get('/', pontoController.listarPontos);

module.exports = router;