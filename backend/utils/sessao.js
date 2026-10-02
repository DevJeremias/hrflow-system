const jwt = require('jsonwebtoken');
const jwtSecret = require('../config/jwtSecret');

// Duração máxima de uma sessão (política SEC-06). Não há refresh token: depois disso, novo login.
const EXPIRACAO_SESSAO = '8h';

// O campo `sv` é a versão da sessão (usuarios.sessao_versao) no momento do login.
const emitirToken = (usuario, nome) => jwt.sign(
    {
        id: usuario.id,
        perfil: usuario.perfil,
        empresa_id: usuario.empresa_id,
        funcionario_id: usuario.funcionario_id || null,
        nome,
        sv: usuario.sessao_versao,
    },
    jwtSecret,
    { expiresIn: EXPIRACAO_SESSAO }
);

module.exports = { EXPIRACAO_SESSAO, emitirToken };
