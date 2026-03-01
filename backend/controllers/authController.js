const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.registrar = async (req, res) => {
    try {
        const { nome, email, senha, perfil } = req.body;
        // Criptografa a senha 
        const salt = await bcrypt.genSalt(10);
        const senhaCripto = await bcrypt.hash(senha, salt);

        const sql = `INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)`;
        await db.query(sql, [nome, email, senhaCripto, perfil || 'Colaborador']);

        res.status(201).json({ mensagem: "Usuário criado com sucesso!" });
    } catch (error) {
        res.status(500).json({ erro: "Erro ao registrar usuário." });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, senha } = req.body;
        const [users] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);

        if (users.length === 0) return res.status(401).json({ erro: "E-mail ou senha inválidos." });

        const usuario = users[0];
        // Compara a senha enviada com a do banco 
        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) return res.status(401).json({ erro: "E-mail ou senha inválidos." });

        // Gera o token JWT que expira em 1 dia 
        const token = jwt.sign(
            { id: usuario.id, perfil: usuario.perfil },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({ token, perfil: usuario.perfil, nome: usuario.nome });
    } catch (error) {
        res.status(500).json({ erro: "Erro ao processar login." });
    }
};