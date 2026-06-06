const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.listarFuncionarios = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        const sql = `
            SELECT f.*, c.nome as cargo_nome, d.nome as departamento_nome 
            FROM funcionarios f
            LEFT JOIN cargos c ON f.cargo_id = c.id
            LEFT JOIN departamentos d ON f.departamento_id = d.id
            WHERE f.empresa_id = ?
        `;
        const [rows] = await db.query(sql, [empresa_id]);
        res.json(rows);
    } catch (error) {
        console.error("Erro ao listar funcionários:", error);
        res.status(500).json({ erro: "Erro ao buscar funcionários." });
    }
};

exports.criarFuncionario = async (req, res) => {
    const empresa_id = req.usuario.empresa_id; 
    
    const { 
        nome, cpf, email, telefone, data_admissao, data_nascimento, 
        endereco, banco, agencia, conta, tipo_conta, 
        cargo_id, departamento_id, tipo_contrato, salario_base, senha 
    } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ erro: "Nome, e-mail e senha são campos obrigatórios." });
    }

    const connection = await db.getConnection();
    try {
        // Inicia Transação para não salvar dados incompletos em caso de erro
        await connection.beginTransaction();

        // 1. Verifica se o e-mail já existe
        const [usuarioExistente] = await connection.query(
            'SELECT id FROM usuarios WHERE email = ?', [email]
        );
        if (usuarioExistente.length > 0) {
            await connection.rollback();
            return res.status(400).json({ erro: "Este e-mail já está registado no sistema." });
        }

        // 2. Insere na tabela 'funcionarios'
        const sqlFuncionario = `
            INSERT INTO funcionarios (
                nome, cpf, email, telefone, data_admissao, data_nascimento, 
                endereco, banco, agencia, conta, tipo_conta, cargo_id, 
                departamento_id, tipo_contrato, salario_base, status, empresa_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ativo', ?)
        `;
        
        const [resultFunc] = await connection.query(sqlFuncionario, [
            nome, cpf || null, email, telefone || null, data_admissao || null, 
            data_nascimento || null, endereco || null, banco || null, agencia || null, 
            conta || null, tipo_conta || null, cargo_id || null, departamento_id || null, 
            tipo_contrato || null, salario_base || null, empresa_id
        ]);

        const funcionarioId = resultFunc.insertId;

        // 3. Encripta a senha com Bcrypt
        const saltRounds = 10;
        const senhaCriptografada = await bcrypt.hash(senha, saltRounds);

        // 4. Cria o login na tabela 'usuarios'
        const sqlUsuario = `
            INSERT INTO usuarios (email, senha, perfil, empresa_id, funcionario_id)
            VALUES (?, ?, 'Colaborador', ?, ?)
        `;
        await connection.query(sqlUsuario, [email, senhaCriptografada, empresa_id, funcionarioId]);

        await connection.commit();
        res.status(201).json({ mensagem: "Colaborador e credenciais de acesso criados com sucesso!" });

    } catch (error) {
        await connection.rollback();
        console.error("Erro ao criar colaborador:", error);
        res.status(500).json({ erro: "Erro interno ao processar o cadastro." });
    } finally {
        connection.release();
    }
};

exports.atualizarFuncionario = async (req, res) => {
    const { id } = req.params;
    const empresa_id = req.usuario.empresa_id;
    const { 
        nome, cpf, email, telefone, data_admissao, data_nascimento, 
        endereco, banco, agencia, conta, tipo_conta,
        cargo_id, departamento_id, tipo_contrato, salario_base, status 
    } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const sql = `
            UPDATE funcionarios 
            SET nome = ?, cpf = ?, email = ?, telefone = ?, data_admissao = ?, data_nascimento = ?, 
                endereco = ?, banco = ?, agencia = ?, conta = ?, tipo_conta = ?, cargo_id = ?, 
                departamento_id = ?, tipo_contrato = ?, salario_base = ?, status = ?
            WHERE id = ? AND empresa_id = ?
        `;
        
        await connection.query(sql, [
            nome, cpf || null, email, telefone || null, data_admissao || null, data_nascimento || null, 
            endereco || null, banco || null, agencia || null, conta || null, tipo_conta || null,
            cargo_id || null, departamento_id || null, tipo_contrato || null, salario_base || null, 
            status || 'Ativo', id, empresa_id
        ]);

        // Sincroniza o e-mail na tabela de login caso o RH o tenha alterado
        await connection.query('UPDATE usuarios SET email = ? WHERE funcionario_id = ? AND empresa_id = ?', [email, id, empresa_id]);

        await connection.commit();
        res.json({ mensagem: "Funcionário atualizado com sucesso!" });
    } catch (error) {
        await connection.rollback();
        console.error("Erro ao atualizar funcionário:", error);
        res.status(500).json({ erro: "Erro ao modificar o funcionário." });
    } finally {
        connection.release();
    }
};

exports.deletarFuncionario = async (req, res) => {
    const { id } = req.params;
    const empresa_id = req.usuario.empresa_id;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Elimina primeiro o acesso de login para não quebrar a Foreign Key
        await connection.query('DELETE FROM usuarios WHERE funcionario_id = ? AND empresa_id = ?', [id, empresa_id]);

        // Elimina o funcionário
        const [result] = await connection.query('DELETE FROM funcionarios WHERE id = ? AND empresa_id = ?', [id, empresa_id]);
        
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ erro: "Funcionário não encontrado." });
        }

        await connection.commit();
        res.json({ mensagem: "Funcionário removido com sucesso!" });
    } catch (error) {
        await connection.rollback();
        console.error("Erro ao deletar funcionário:", error);
        res.status(500).json({ erro: "Erro ao remover o funcionário." });
    } finally {
        connection.release();
    }
};