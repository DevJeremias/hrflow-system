const express = require('express');
const router = express.Router();
const estruturaController = require('../controllers/estruturaController');
const verificarPerfil = require('../middlewares/roleMiddleware');

// Protege todas as rotas de estrutura. Apenas Administrador e RH podem gerir.
router.use(verificarPerfil(['Administrador', 'RH']));

// Rotas de Departamentos
router.get('/departamentos', estruturaController.listarDepartamentos);
router.post('/departamentos', estruturaController.criarDepartamento);
router.put('/departamentos/:id', estruturaController.atualizarDepartamento);
router.delete('/departamentos/:id', estruturaController.deletarDepartamento);

// Rotas de Cargos
router.get('/cargos', estruturaController.listarCargos);
router.post('/cargos', estruturaController.criarCargo);
router.put('/cargos/:id', estruturaController.atualizarCargo);
router.delete('/cargos/:id', estruturaController.deletarCargo);

module.exports = router;