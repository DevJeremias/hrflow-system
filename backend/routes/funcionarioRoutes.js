const express = require('express');
const router = express.Router();
const funcionarioController = require('../controllers/funcionarioController');

// Rota POST para criar funcionário
router.post('/', funcionarioController.criarFuncionario);
router.get('/', funcionarioController.listarFuncionarios);

module.exports = router;