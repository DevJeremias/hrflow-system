const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// NOVA FUNÇÃO: Cria a Empresa e o Usuário Admin ao mesmo tempo
exports.registrarConta = async (req, res) => {
    try {
        const { nomeEmpresa, nomeAdmin, email, senha } = req.body;

        if (!nomeEmpresa || !nomeAdmin || !email || !senha) {
            return res.status(400).json({ erro: "Preencha todos os campos." });
        }

        // 1. Verifica se o email já existe para evitar duplicidade
        const [users] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (users.length > 0) return res.status(400).json({ erro: "E-mail já cadastrado." });

        // 2. Cria a Empresa no banco
        const sqlEmpresa = `INSERT INTO empresas (nome_fantasia) VALUES (?)`;
        const [resultEmpresa] = await db.query(sqlEmpresa, [nomeEmpresa]);
        const empresaId = resultEmpresa.insertId; // Pega o ID da empresa que acabou de nascer

        // 3. Criptografa a senha
        const salt = await bcrypt.genSalt(10);
        const senhaCripto = await bcrypt.hash(senha, salt);

        // 4. Cria o Usuário Admin vinculado a essa nova empresa
        const sqlUsuario = `INSERT INTO usuarios (nome, email, senha, perfil, empresa_id) VALUES (?, ?, ?, ?, ?)`;
        
        await db.query(sqlUsuario, [nomeAdmin, email, senhaCripto, 'Administrador', empresaId]);

        res.status(201).json({ mensagem: "Conta criada com sucesso!" });
    } catch (error) {
        console.error("Erro ao registrar conta:", error);
        res.status(500).json({ erro: "Erro ao criar conta." });
    }
};

// ATUALIZADO: Agora o login guarda a empresa_id no Token
exports.login = async (req, res) => {
    try {
        const { email, senha } = req.body;
        const [users] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);

        if (users.length === 0) return res.status(401).json({ erro: "E-mail ou senha inválidos." });

        const usuario = users[0];
        
        // Verifica a senha (tenta bcrypt, se falhar tenta texto puro pelo nosso teste antigo)
        let senhaValida = false;
        try {
            senhaValida = await bcrypt.compare(senha, usuario.senha);
        } catch (e) {}

        if (!senhaValida) {
            senhaValida = (senha === usuario.senha);
        }

        if (!senhaValida) return res.status(401).json({ erro: "E-mail ou senha inválidos." });

        // O PULO DO GATO: Colocamos o empresa_id dentro do token JWT!
        const token = jwt.sign(
            { 
                id: usuario.id, 
                perfil: usuario.perfil, 
                empresa_id: usuario.empresa_id // <- A Mágica acontece aqui
            },
            process.env.JWT_SECRET || 'chave_secreta_hrflow',
            { expiresIn: '1d' }
        );

        res.json({ token, perfil: usuario.perfil, nome: usuario.nome });
    } catch (error) {
        console.error("erro no login:", error);
        res.status(500).json({ erro: "Erro ao processar login." });
    }
};