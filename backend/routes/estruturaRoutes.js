const express = require('express');
const router = express.Router();
const estruturaController = require('../controllers/estruturaController');
const verificarPerfil = require('../middlewares/roleMiddleware');

// Proteção extra: Somente Admin e RH podem mexer na estrutura da empresa
router.use(verificarPerfil(['Administrador', 'RH']));

router.get('/departamentos', estruturaController.listarDepartamentos);
router.post('/departamentos', estruturaController.salvarDepartamento);

router.get('/cargos', estruturaController.listarCargos);
router.post('/cargos', estruturaController.salvarCargo);

module.exports = router;