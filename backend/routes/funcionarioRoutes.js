const express = require('express');
const router = express.Router();
const funcionarioController = require('../controllers/funcionarioController');
const verificarPerfil = require('../middlewares/roleMiddleware');

// O POST agora exige que o usuário seja 'Administrador' ou 'RH'
router.post('/', verificarPerfil(['Administrador', 'RH']), funcionarioController.criarFuncionario);

// O GET continua liberado para qualquer um que esteja logado (Colaboradores podem ver a lista)
router.get('/', funcionarioController.listarFuncionarios);

// Rota DELETE para excluir funcionário (Apenas Admin e RH)
router.delete('/:id', verificarPerfil(['Administrador', 'RH']), funcionarioController.deletarFuncionario);

// Rota PUT para editar funcionário (Apenas Admin e RH)
router.put('/:id', verificarPerfil(['Administrador', 'RH']), funcionarioController.atualizarFuncionario);

// É ESTA LINHA QUE O EXPRESS ESTAVA SENTINDO FALTA SE O ARQUIVO QUEBROU
module.exports = router;