const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.obterMeuPerfil = async (req, res) => {
    const funcionario_id = req.usuario.funcionario_id;
    const empresa_id = req.usuario.empresa_id;
    const perfil_usuario = req.usuario.perfil;

    // Cenário de proteção para contas sem vínculo físico na tabela de funcionários (Admin ou SQL Manual)
    if (!funcionario_id) {
        if (perfil_usuario === 'Administrador') {
            try {
                const [admin] = await db.query('SELECT email FROM usuarios WHERE id = ?', [req.usuario.id]);
                return res.json({
                    nome: "Administrador Geral",
                    email: admin[0]?.email || '',
                    cargo: "Gestão do Sistema",
                    departamento: "Administração",
                    isAdmin: true
                });
            } catch (error) {
                console.error("Erro ao buscar perfil administrativo:", error);
                return res.status(500).json({ erro: "Erro ao buscar perfil administrativo." });
            }
        } else {
            try {
                const [user] = await db.query('SELECT nome, email FROM usuarios WHERE id = ?', [req.usuario.id]);
                return res.json({
                    nome: user[0]?.nome || "Colaborador de Teste",
                    email: user[0]?.email || "",
                    cargo: "Vínculo Pendente (Cadastro Incompleto)",
                    departamento: "Não atrelado",
                    isAdmin: false
                });
            } catch (error) {
                console.error("Erro ao buscar perfil temporário:", error);
                return res.status(500).json({ erro: "Erro ao buscar perfil temporário." });
            }
        }
    }

    // Fluxo operacional padrão para colaboradores integrados no ecossistema
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
        
        if (rows.length === 0) {
            return res.status(404).json({ erro: "Perfil não encontrado no sistema." });
        }
        
        res.json({ ...rows[0], isAdmin: false });
    } catch (error) {
        console.error("Erro ao buscar meu perfil:", error);
        res.status(500).json({ erro: "Erro interno ao buscar perfil." });
    }
};

exports.atualizarMeusDados = async (req, res) => {
    const { email, telefone, avatar } = req.body;
    const usuario_id = req.usuario.id;
    const funcionario_id = req.usuario.funcionario_id;

    if (!email) {
        return res.status(400).json({ erro: "O e-mail é um campo obrigatório." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Verifica a disponibilidade do e-mail para evitar colisões de chaves únicas
        const [users] = await connection.query('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, usuario_id]);
        if (users.length > 0) {
            await connection.rollback();
            return res.status(400).json({ erro: "Este e-mail já está a ser utilizado por outra conta." });
        }

        // Atualização da tabela de autenticação
        await connection.query('UPDATE usuarios SET email = ? WHERE id = ?', [email, usuario_id]);

        // Atualização sincronizada na tabela de dados corporativos (apenas se houver o vínculo necessário)
        if (funcionario_id) {
            await connection.query(
                'UPDATE funcionarios SET email = ?, telefone = ?, avatar = ? WHERE id = ?', 
                [email, telefone || null, avatar || null, funcionario_id]
            );
        }

        await connection.commit();
        res.json({ mensagem: "Os seus dados foram atualizados com sucesso!" });

    } catch (error) {
        await connection.rollback();
        console.error("Erro ao atualizar dados:", error);
        res.status(500).json({ erro: "Erro interno ao atualizar os dados." });
    } finally {
        connection.release();
    }
};

exports.alterarMinhaSenha = async (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    const usuario_id = req.usuario.id;

    if (!senhaAtual || !novaSenha) {
        return res.status(400).json({ erro: "A senha atual e a nova senha são obrigatórias." });
    }

    try {
        const [user] = await db.query('SELECT senha FROM usuarios WHERE id = ?', [usuario_id]);
        if (user.length === 0) {
            return res.status(404).json({ erro: "Usuário não encontrado no sistema." });
        }

        const senhaValida = await bcrypt.compare(senhaAtual, user[0].senha);
        if (!senhaValida) {
            return res.status(400).json({ erro: "A senha atual informada está incorreta." });
        }

        const saltRounds = 10;
        const senhaCriptografada = await bcrypt.hash(novaSenha, saltRounds);

        await db.query('UPDATE usuarios SET senha = ? WHERE id = ?', [senhaCriptografada, usuario_id]);
        
        res.json({ mensagem: "Senha atualizada com sucesso!" });
    } catch (error) {
        console.error("Erro ao alterar senha:", error);
        res.status(500).json({ erro: "Erro interno ao processar a troca de senha." });
    }
};