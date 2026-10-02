const express = require('express');
const router = express.Router();
const funcionarioController = require('../controllers/funcionarioController');
const verificarPerfil = require('../middlewares/roleMiddleware');
const validarEntrada = require('../middlewares/validarEntrada');
const { idDaRota, criarFuncionario, atualizarFuncionario } = require('../schemas/funcionarioSchemas');
const { paginacao } = require('../schemas/paginacao');

// O POST agora exige que o usuário seja 'Administrador' ou 'RH'
router.post('/', verificarPerfil(['Administrador', 'RH']), validarEntrada({ body: criarFuncionario }), funcionarioController.criarFuncionario);

router.get('/', verificarPerfil(['Administrador', 'RH']), validarEntrada({ query: paginacao }), funcionarioController.listarFuncionarios);

// Rota DELETE para excluir funcionário (Apenas Admin e RH)
router.delete('/:id', verificarPerfil(['Administrador', 'RH']), validarEntrada({ params: idDaRota }), funcionarioController.deletarFuncionario);

// Rota PUT para editar funcionário (Apenas Admin e RH)
router.put('/:id', verificarPerfil(['Administrador', 'RH']), validarEntrada({ params: idDaRota, body: atualizarFuncionario }), funcionarioController.atualizarFuncionario);

// É ESTA LINHA QUE O EXPRESS ESTAVA SENTINDO FALTA SE O ARQUIVO QUEBROU
module.exports = router;