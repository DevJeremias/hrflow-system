const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.registrar = async (req, res) => {
    try {
        const { nome, email, senha, perfil } = req.body;
        
        // gera o hash da senha antes de salvar
        const salt = await bcrypt.genSalt(10);
        const senhaCripto = await bcrypt.hash(senha, salt);

        const sql = `INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)`;
        await db.query(sql, [nome, email, senhaCripto, perfil || 'Colaborador']);

        res.status(201).json({ mensagem: "Usuário criado com sucesso!" });
    } catch (error) {
        console.error("erro no registro:", error);
        res.status(500).json({ erro: "Erro ao registrar usuário." });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, senha } = req.body;
        const [users] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);

        // se nao achou o email, ja barra direto
        if (users.length === 0) return res.status(401).json({ erro: "E-mail ou senha inválidos." });

        const usuario = users[0];
        
        // verifica a senha. testa o bcrypt primeiro pq eh o padrao
        let senhaValida = false;
        try {
            senhaValida = await bcrypt.compare(senha, usuario.senha);
        } catch (e) {
            // ignora se der erro pq o hash eh invalido
        }

        // se o bcrypt falhar, testa como texto puro pra quebrar nosso galho do teste no banco
        if (!senhaValida) {
            senhaValida = (senha === usuario.senha);
        }

        if (!senhaValida) return res.status(401).json({ erro: "E-mail ou senha inválidos." });

        // cria o passaporte. coloquei um fallback caso a gnt esqueça de criar o .env
        const token = jwt.sign(
            { id: usuario.id, perfil: usuario.perfil },
            process.env.JWT_SECRET || 'chave_secreta_hrflow',
            { expiresIn: '1d' }
        );

        res.json({ token, perfil: usuario.perfil, nome: usuario.nome });
    } catch (error) {
        console.error("erro no login:", error);
        res.status(500).json({ erro: "Erro ao processar login." });
    }
};