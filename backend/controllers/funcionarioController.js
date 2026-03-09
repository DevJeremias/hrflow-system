const db = require('../config/db');

exports.criarFuncionario = async (req, res) => {
    try {
        const { nome, cpf, email, telefone, data_admissao, cargo_id, departamento_id } = req.body;

        // Validação básica
        if (!nome || !cpf || !email || !data_admissao) {
            return res.status(400).json({ erro: "Campos obrigatórios faltando." });
        }

        const sql = `INSERT INTO funcionarios (nome, cpf, email, telefone, data_admissao, cargo_id, departamento_id) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        const [result] = await db.query(sql, [nome, cpf, email, telefone, data_admissao, cargo_id, departamento_id]);

        res.status(201).json({ mensagem: "Funcionário cadastrado com sucesso!", id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao cadastrar funcionário no banco de dados." });
    }
};

// Listar todos os funcionários
exports.listarFuncionarios = async (req, res) => {
    try {
        const sql = `
            SELECT f.*, c.nome AS cargo, d.nome AS departamento 
            FROM funcionarios f
            LEFT JOIN cargos c ON f.cargo_id = c.id
            LEFT JOIN departamentos d ON f.departamento_id = d.id
        `;
        const [rows] = await db.query(sql);
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao buscar funcionários." });
    }
};

// Excluir um funcionário pelo ID
exports.deletarFuncionario = async (req, res) => {
    try {
        const { id } = req.params; // Pega o número que vem na URL

        const sql = `DELETE FROM funcionarios WHERE id = ?`;
        const [result] = await db.query(sql, [id]);

        // Se nenhuma linha foi afetada, o ID não existe
        if (result.affectedRows === 0) {
            return res.status(404).json({ erro: "Funcionário não encontrado." });
        }

        res.status(200).json({ mensagem: "Funcionário excluído com sucesso!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao excluir funcionário no banco de dados." });
    }
};

// Atualizar um funcionário pelo ID
exports.atualizarFuncionario = async (req, res) => {
    try {
        const { id } = req.params; // Pega o ID da URL
        const { nome, cpf, email, telefone, cargo_id, departamento_id, status } = req.body; // Pega os novos dados

        const sql = `
            UPDATE funcionarios 
            SET nome = ?, cpf = ?, email = ?, telefone = ?, cargo_id = ?, departamento_id = ?, status = ? 
            WHERE id = ?
        `;
        
        const [result] = await db.query(sql, [nome, cpf, email, telefone, cargo_id, departamento_id, status, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ erro: "Funcionário não encontrado." });
        }

        res.status(200).json({ mensagem: "Funcionário atualizado com sucesso!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao atualizar funcionário no banco de dados." });
    }
};