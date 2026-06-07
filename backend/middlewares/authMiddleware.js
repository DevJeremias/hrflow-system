const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
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

    try {
        // 3. Valida o crachá usando a chave secreta do seu .env (ou a padrão, caso o .env falhe)
        const secret = process.env.JWT_SECRET || 'chave_secreta_padrao'; 
        const verified = jwt.verify(token, secret);
        
        // 4. Se for válido, guarda os dados do utilizador e deixa passar para a rota
        req.usuario = verified;
        next();
        
    } catch (erro) {
        // Se cair aqui, é porque o crachá expirou ou foi corrompido
        console.error("Erro na verificação do Token:", erro.message);
        return res.status(400).json({ erro: 'Token inválido ou expirado.' });
    }
};