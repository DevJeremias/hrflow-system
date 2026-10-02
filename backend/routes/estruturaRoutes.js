const express = require('express');
const router = express.Router();
const estruturaController = require('../controllers/estruturaController');
const verificarPerfil = require('../middlewares/roleMiddleware');
const validarEntrada = require('../middlewares/validarEntrada');
const { idDaRota, departamento, cargo } = require('../schemas/estruturaSchemas');
const { paginacao } = require('../schemas/paginacao');

// Protege todas as rotas de estrutura. Apenas Administrador e RH podem gerir.
router.use(verificarPerfil(['Administrador', 'RH']));

// Rotas de Departamentos
router.get('/departamentos', validarEntrada({ query: paginacao }), estruturaController.listarDepartamentos);
router.post('/departamentos', validarEntrada({ body: departamento }), estruturaController.criarDepartamento);
router.put('/departamentos/:id', validarEntrada({ params: idDaRota, body: departamento }), estruturaController.atualizarDepartamento);
router.delete('/departamentos/:id', validarEntrada({ params: idDaRota }), estruturaController.deletarDepartamento);

// Rotas de Cargos
router.get('/cargos', validarEntrada({ query: paginacao }), estruturaController.listarCargos);
router.post('/cargos', validarEntrada({ body: cargo }), estruturaController.criarCargo);
router.put('/cargos/:id', validarEntrada({ params: idDaRota, body: cargo }), estruturaController.atualizarCargo);
router.delete('/cargos/:id', validarEntrada({ params: idDaRota }), estruturaController.deletarCargo);

module.exports = router;