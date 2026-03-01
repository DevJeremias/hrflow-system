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