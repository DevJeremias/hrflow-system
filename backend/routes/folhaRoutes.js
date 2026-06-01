const express = require('express');
const router = express.Router();
const folhaController = require('../controllers/folhaController');
const verificarPerfil = require('../middlewares/roleMiddleware');

// Rota de processamento (Protegida)
router.get('/processar', verificarPerfil(['Administrador', 'RH']), folhaController.processarFolha);

module.exports = router;