const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Atualizado para chamar a nova função que cria a Empresa + Admin
router.post('/registrar', authController.registrarConta);
router.post('/login', authController.login);

module.exports = router;