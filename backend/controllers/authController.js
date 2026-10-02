const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const jwtSecret = require('../config/jwtSecret');

// Cria a Empresa e o Usuário Admin ao mesmo tempo. A entrada já chegou validada pela rota.
exports.registrarConta = async (req, res) => {
    const { nomeEmpresa, nomeAdmin, email, senha } = req.dadosValidados;
    let connection;

    try {
        // Evita o custo do hash quando o e-mail já existe. A corrida entre dois cadastros
        // iguais é resolvida pela chave única de usuarios.email, dentro da transação.
        const [users] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (users.length > 0) return res.status(409).json({ erro: "E-mail já cadastrado." });

        const salt = await bcrypt.genSalt(10);
        const senhaCripto = await bcrypt.hash(senha, salt);

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [resultEmpresa] = await connection.query('INSERT INTO empresas (nome) VALUES (?)', [nomeEmpresa]);
        await connection.query(
            'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id) VALUES (?, ?, ?, ?, ?)',
            [nomeAdmin, email, senhaCripto, 'Administrador', resultEmpresa.insertId]
        );

        await connection.commit();
        res.status(201).json({ mensagem: "Conta criada com sucesso!" });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: "E-mail já cadastrado." });
        console.error("Erro ao registrar conta:", error);
        res.status(500).json({ erro: "Erro ao criar conta." });
    } finally {
        if (connection) connection.release();
    }
};

// ATUALIZADO: Login inteligente que injeta empresa_id, funcionario_id e o Nome correto no Token
exports.login = async (req, res) => {
    try {
        const { email, senha } = req.dadosValidados;

        const [users] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);

        if (users.length === 0) return res.status(401).json({ erro: "E-mail ou senha inválidos." });

        const usuario = users[0];
        
        const senhaValida = await bcrypt.compare(senha, usuario.senha);

        if (!senhaValida) return res.status(401).json({ erro: "E-mail ou senha inválidos." });

        // BUSCA O NOME REAL DO COLABORADOR
        // Se for Admin, o nome já está em usuario.nome. Se for Colaborador, o nome está na tabela funcionarios.
        let nomeUsuario = usuario.nome; 
        if (usuario.funcionario_id) {
            const [funcs] = await db.query('SELECT nome FROM funcionarios WHERE id = ?', [usuario.funcionario_id]);
            if (funcs.length > 0) {
                nomeUsuario = funcs[0].nome;
            }
        }

        // O PULO DO GATO DEFINITIVO: O Token agora carrega a identidade completa
        const token = jwt.sign(
            { 
                id: usuario.id, 
                perfil: usuario.perfil, 
                empresa_id: usuario.empresa_id,
                funcionario_id: usuario.funcionario_id || null, // Essencial para a tela de Perfil
                nome: nomeUsuario // Essencial para o cabeçalho e menu lateral não mostrarem "Utilizador"
            },
            jwtSecret,
            { expiresIn: '1d' }
        );

        res.json({ token, perfil: usuario.perfil, nome: nomeUsuario });
    } catch (error) {
        console.error("erro no login:", error);
        res.status(500).json({ erro: "Erro ao processar login." });
    }
};