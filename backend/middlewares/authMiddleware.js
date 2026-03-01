const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.header('Authorization');
    
    // Log para ver o que o Postman está enviando
    console.log("--> Header recebido:", authHeader);

    if (!authHeader) {
        return res.status(401).json({ erro: "Acesso negado. Token não fornecido." });
    }

    try {
        // Tenta pegar o token após o espaço (Bearer TOKEN)
        // Se não houver espaço, pega o authHeader inteiro
        const token = authHeader.includes(" ") ? authHeader.split(" ")[1] : authHeader;
        
        console.log("--> Token extraído:", token);

        const verificado = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = verificado;
        next();
    } catch (error) {
        console.log("--> Erro na verificação:", error.message);
        res.status(400).json({ erro: "Token inválido." });
    }
};