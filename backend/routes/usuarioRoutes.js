const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

// Quando o React chamar GET /api/usuarios/perfil, esta rota atende
router.get('/perfil', usuarioController.meuPerfil);

module.exports = router;