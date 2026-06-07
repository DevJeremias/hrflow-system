const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.obterMeuPerfil = async (req, res) => {
    const funcionario_id = req.usuario.funcionario_id;
    const empresa_id = req.usuario.empresa_id;
    const perfil_usuario = req.usuario.perfil;

    if (!funcionario_id) {
        if (perfil_usuario === 'Administrador') {
            try {
                const [admin] = await db.query('SELECT nome, email, avatar FROM usuarios WHERE id = ?', [req.usuario.id]);
                return res.json({
                    nome: admin[0]?.nome || "Administrador Geral",
                    email: admin[0]?.email || '',
                    avatar: admin[0]?.avatar || null,
                    cargo: "Gestão do Sistema",
                    departamento: "Administração",
                    isAdmin: true
                });
            } catch (error) {
                return res.status(500).json({ erro: "Erro ao buscar perfil administrativo." });
            }
        } else {
            return res.json({
                nome: "Colaborador sem Vínculo",
                email: "",
                cargo: "Vínculo Pendente",
                departamento: "Não atrelado",
                isAdmin: false
            });
        }
    }

    try {
        const sql = `
            SELECT f.nome, f.email, f.telefone, f.cpf, f.data_nascimento, f.endereco, f.avatar,
                   c.nome as cargo, d.nome as departamento
            FROM funcionarios f
            LEFT JOIN cargos c ON f.cargo_id = c.id
            LEFT JOIN departamentos d ON f.departamento_id = d.id
            WHERE f.id = ? AND f.empresa_id = ?
        `;
        const [rows] = await db.query(sql, [funcionario_id, empresa_id]);
        
        if (rows.length === 0) return res.status(404).json({ erro: "Perfil não encontrado." });
        
        res.json({ ...rows[0], isAdmin: false });
    } catch (error) {
        res.status(500).json({ erro: "Erro interno ao buscar perfil." });
    }
};

exports.atualizarMeusDados = async (req, res) => {
    // Agora aceitamos a alteração de Nome diretamente
    const { nome, email, telefone, avatar } = req.body;
    const usuario_id = req.usuario.id;
    const funcionario_id = req.usuario.funcionario_id;

    if (!email || !nome) {
        return res.status(400).json({ erro: "Nome e e-mail são obrigatórios." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [users] = await connection.query('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, usuario_id]);
        if (users.length > 0) {
            await connection.rollback();
            return res.status(400).json({ erro: "E-mail já utilizado por outra conta." });
        }

        // Atualiza a tabela de usuários (Aplica-se ao Admin e login do Colaborador)
        await connection.query('UPDATE usuarios SET email = ?, nome = ?, avatar = ? WHERE id = ?', [email, nome, avatar || null, usuario_id]);

        // Sincroniza a tabela de RH (Aplica-se apenas ao Colaborador)
        if (funcionario_id) {
            await connection.query(
                'UPDATE funcionarios SET email = ?, nome = ?, telefone = ?, avatar = ? WHERE id = ?', 
                [email, nome, telefone || null, avatar || null, funcionario_id]
            );
        }

        await connection.commit();
        res.json({ mensagem: "Os seus dados foram atualizados com sucesso!" });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ erro: "Erro interno ao atualizar os dados." });
    } finally {
        connection.release();
    }
};

exports.alterarMinhaSenha = async (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    const usuario_id = req.usuario.id;

    if (!senhaAtual || !novaSenha) return res.status(400).json({ erro: "Senhas são obrigatórias." });

    try {
        const [user] = await db.query('SELECT senha FROM usuarios WHERE id = ?', [usuario_id]);
        if (user.length === 0) return res.status(404).json({ erro: "Usuário não encontrado." });

        const senhaValida = await bcrypt.compare(senhaAtual, user[0].senha);
        if (!senhaValida) return res.status(400).json({ erro: "A senha atual está incorreta." });

        const senhaCriptografada = await bcrypt.hash(novaSenha, 10);
        await db.query('UPDATE usuarios SET senha = ? WHERE id = ?', [senhaCriptografada, usuario_id]);
        res.json({ mensagem: "Senha atualizada com sucesso!" });
    } catch (error) {
        res.status(500).json({ erro: "Erro interno ao trocar a senha." });
    }
};