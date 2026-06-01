const express = require('express');
const router = express.Router();
const folhaController = require('../controllers/folhaController');
const verificarPerfil = require('../middlewares/roleMiddleware');

// Rota Geral (Apenas Admin e RH)
router.get('/processar', verificarPerfil(['Administrador', 'RH']), folhaController.processarFolha);

// Rota Individual (Qualquer pessoa logada pode ver o SEU próprio)
router.get('/meu-holerite', folhaController.meuHolerite);

module.exports = router;