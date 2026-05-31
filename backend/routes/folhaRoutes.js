const express = require('express');
const router = express.Router();
const folhaController = require('../controllers/folhaController');
const verificarPerfil = require('../middlewares/roleMiddleware');

// Apenas o Administrador e o RH podem processar e ver a folha de pagamento de todos
router.get('/processar', verificarPerfil(['Administrador', 'RH']), folhaController.gerarFolha);

module.exports = router;