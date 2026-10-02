const jwt = require('jsonwebtoken');
const jwtSecret = require('../config/jwtSecret');
const db = require('../config/db');

module.exports = async (req, res, next) => {
    // 1. Procura o crachá no cabeçalho da requisição
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    
    if (!authHeader) {
        return res.status(401).json({ erro: 'Acesso negado. Nenhum token foi fornecido.' });
    }

    // 2. O React envia o token no formato "Bearer eyJ...". Precisamos separar a palavra "Bearer" do código.
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ erro: 'Token mal formatado.' });
    }

    const token = parts[1];

    let verified;
    try {
        // 3. Valida o crachá usando a chave secreta validada na subida
        verified = jwt.verify(token, jwtSecret);
    } catch (erro) {
        // Se cair aqui, é porque o crachá expirou ou foi corrompido
        console.error("Erro na verificação do Token:", erro.message);
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }

    try {
        // 4. Assinatura válida não basta: o usuário precisa continuar existindo, o funcionário
        // vinculado não pode estar inativo e a versão da sessão tem que ser a do token.
        const [linhas] = await db.query(
            `SELECT u.sessao_versao, f.status AS funcionario_status
             FROM usuarios u
             LEFT JOIN funcionarios f ON f.id = u.funcionario_id AND f.empresa_id = u.empresa_id
             WHERE u.id = ?`,
            [verified.id]
        );
        const atual = linhas[0];
        if (!atual || atual.sessao_versao !== verified.sv || atual.funcionario_status === 'Inativo') {
            return res.status(401).json({ erro: 'Sessão encerrada. Faça login novamente.' });
        }

        // 5. Se for válido, guarda os dados do utilizador e deixa passar para a rota
        req.usuario = verified;
        next();
    } catch (erro) {
        console.error("Erro ao conferir a sessão:", erro);
        return res.status(500).json({ erro: 'Erro ao validar a sessão.' });
    }
};
