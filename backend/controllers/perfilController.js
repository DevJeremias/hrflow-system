const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { responderErro } = require('../utils/erros');

// Sem funcionário vinculado não há cargo nem departamento reais: o Administrador de conta
// recém-criada e um usuário ainda sem vínculo recebem um rótulo no lugar.
const ROTULOS_SEM_VINCULO = {
    Administrador: { cargo: 'Gestão do Sistema', departamento: 'Administração' },
    RH: { cargo: 'Vínculo Pendente', departamento: 'Não atrelado' },
    Colaborador: { cargo: 'Vínculo Pendente', departamento: 'Não atrelado' },
};

// Uma única resposta para todos os perfis: o que depende do vínculo com o funcionário vem null
// quando ele não existe, e `vinculado` diz ao cliente se há contrato e dados bancários a mostrar.
exports.obterMeuPerfil = async (req, res) => {
    try {
        const sql = `
            SELECT u.perfil, COALESCE(f.nome, u.nome) AS nome, u.email, u.avatar, f.id AS funcionario_id,
                   f.telefone, f.cpf,
                   DATE_FORMAT(f.data_nascimento, '%Y-%m-%d') AS data_nascimento,
                   DATE_FORMAT(f.data_admissao, '%Y-%m-%d') AS data_admissao,
                   f.endereco, f.tipo_contrato, COALESCE(f.nivel, c.nivel) AS nivel,
                   f.banco, f.agencia, f.conta, f.tipo_conta,
                   c.nome AS cargo, d.nome AS departamento
            FROM usuarios u
            LEFT JOIN funcionarios f ON f.id = u.funcionario_id AND f.empresa_id = u.empresa_id
            LEFT JOIN cargos c ON c.id = f.cargo_id AND c.empresa_id = f.empresa_id
            LEFT JOIN departamentos d ON d.id = f.departamento_id AND d.empresa_id = f.empresa_id
            WHERE u.id = ? AND u.empresa_id = ?
        `;
        const [rows] = await db.query(sql, [req.usuario.id, req.usuario.empresa_id]);
        if (rows.length === 0) return res.status(404).json({ erro: "Perfil não encontrado." });

        const { funcionario_id, ...perfil } = rows[0];
        const vinculado = funcionario_id !== null;
        res.json({
            ...perfil,
            ...(vinculado ? {} : ROTULOS_SEM_VINCULO[perfil.perfil]),
            vinculado,
        });
    } catch (error) {
        responderErro(res, error, "Erro interno ao buscar perfil.");
    }
};

exports.atualizarMeusDados = async (req, res) => {
    // Agora aceitamos a alteração de Nome diretamente
    const { nome, email, telefone, avatar } = req.dadosValidados.body;
    const usuario_id = req.usuario.id;
    const funcionario_id = req.usuario.funcionario_id;
    const empresa_id = req.usuario.empresa_id;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [users] = await connection.query('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, usuario_id]);
        if (users.length > 0) {
            await connection.rollback();
            return res.status(400).json({ erro: "E-mail já utilizado por outra conta." });
        }

        // Atualiza a tabela de usuários (Aplica-se ao Admin e login do Colaborador)
        await connection.query('UPDATE usuarios SET email = ?, nome = ?, avatar = ? WHERE id = ? AND empresa_id = ?', [email, nome, avatar, usuario_id, empresa_id]);

        // Sincroniza a tabela de RH (Aplica-se apenas ao Colaborador)
        if (funcionario_id) {
            await connection.query(
                'UPDATE funcionarios SET email = ?, nome = ?, telefone = ?, avatar = ? WHERE id = ? AND empresa_id = ?',
                [email, nome, telefone, avatar, funcionario_id, empresa_id]
            );
        }

        await connection.commit();
        res.json({ mensagem: "Os seus dados foram atualizados com sucesso!" });
    } catch (error) {
        await connection.rollback();
        responderErro(res, error, "Erro interno ao atualizar os dados.");
    } finally {
        connection.release();
    }
};

exports.alterarMinhaSenha = async (req, res) => {
    const { senhaAtual, novaSenha } = req.dadosValidados.body;
    const usuario_id = req.usuario.id;

    try {
        const [user] = await db.query('SELECT senha FROM usuarios WHERE id = ?', [usuario_id]);
        if (user.length === 0) return res.status(404).json({ erro: "Usuário não encontrado." });

        const senhaValida = await bcrypt.compare(senhaAtual, user[0].senha);
        if (!senhaValida) return res.status(400).json({ erro: "A senha atual está incorreta." });

        const senhaCriptografada = await bcrypt.hash(novaSenha, 10);
        await db.query('UPDATE usuarios SET senha = ?, sessao_versao = sessao_versao + 1 WHERE id = ?', [senhaCriptografada, usuario_id]);
        res.json({ mensagem: "Senha atualizada com sucesso! Entre novamente." });
    } catch (error) {
        responderErro(res, error, "Erro interno ao trocar a senha.");
    }
};