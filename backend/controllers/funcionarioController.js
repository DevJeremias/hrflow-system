const db = require('../config/db');

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
        console.error("Erro ao listar:", error);
        res.status(500).json({ erro: "Erro ao buscar funcionários" });
    }
};

exports.criarFuncionario = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        let { 
            nome, cpf, email, telefone, data_admissao, data_nascimento, 
            endereco, banco, agencia, conta, tipo_conta, 
            nivel, tipo_contrato, salario_base,
            cargo_id, departamento_id, status 
        } = req.body;
        
        const admissaoFormatada = (data_admissao && data_admissao !== '') ? data_admissao : null;
        const nascimentoFormatado = (data_nascimento && data_nascimento !== '') ? data_nascimento : null;
        const salarioFormatado = (salario_base && !isNaN(salario_base)) ? parseFloat(salario_base) : null;

        const sql = `INSERT INTO funcionarios 
            (nome, cpf, email, telefone, data_admissao, data_nascimento, endereco, banco, agencia, conta, tipo_conta, nivel, tipo_contrato, salario_base, cargo_id, departamento_id, status, empresa_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await db.query(sql, [nome, cpf, email, telefone, admissaoFormatada, nascimentoFormatado, endereco, banco, agencia, conta, tipo_conta, nivel, tipo_contrato, salarioFormatado, cargo_id, departamento_id, status, empresa_id]);
        
        res.status(201).json({ mensagem: "Colaborador criado com sucesso" });
    } catch (error) {
        console.error("Erro ao criar:", error);
        res.status(500).json({ erro: "Erro ao criar funcionário" });
    }
};

exports.atualizarFuncionario = async (req, res) => {
    try {
        const { id } = req.params;
        let { 
            nome, cpf, email, telefone, data_admissao, data_nascimento, 
            endereco, banco, agencia, conta, tipo_conta, 
            nivel, tipo_contrato, salario_base,
            cargo_id, departamento_id, status 
        } = req.body;

        const admissaoFormatada = (data_admissao && data_admissao !== '') ? data_admissao : null;
        const nascimentoFormatado = (data_nascimento && data_nascimento !== '') ? data_nascimento : null;
        const salarioFormatado = (salario_base && !isNaN(salario_base)) ? parseFloat(salario_base) : null;

        if (isNaN(cargo_id) && cargo_id) {
            const [cargos] = await db.query('SELECT id FROM cargos WHERE nome = ? LIMIT 1', [cargo_id]);
            cargo_id = cargos.length > 0 ? cargos[0].id : null;
        }
        if (isNaN(departamento_id) && departamento_id) {
            const [depts] = await db.query('SELECT id FROM departamentos WHERE nome = ? LIMIT 1', [departamento_id]);
            departamento_id = depts.length > 0 ? depts[0].id : null;
        }

        const sql = `UPDATE funcionarios 
            SET nome = ?, cpf = ?, email = ?, telefone = ?, data_admissao = ?, data_nascimento = ?, 
            endereco = ?, banco = ?, agencia = ?, conta = ?, tipo_conta = ?, 
            nivel = ?, tipo_contrato = ?, salario_base = ?,
            cargo_id = ?, departamento_id = ?, status = ? 
            WHERE id = ?`;
            
        const [result] = await db.query(sql, [nome, cpf, email, telefone, admissaoFormatada, nascimentoFormatado, endereco, banco, agencia, conta, tipo_conta, nivel, tipo_contrato, salarioFormatado, cargo_id, departamento_id, status, id]);

        if (result.affectedRows === 0) return res.status(404).json({ erro: "Funcionário não encontrado." });
        res.status(200).json({ mensagem: "Funcionário atualizado!" });
    } catch (error) {
        console.error("Erro ao atualizar:", error);
        res.status(500).json({ erro: "Erro ao atualizar funcionário." });
    }
};

exports.deletarFuncionario = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM funcionarios WHERE id = ?', [id]);
        res.status(200).json({ mensagem: "Funcionário excluído." });
    } catch (error) {
        console.error("Erro ao excluir:", error);
        res.status(500).json({ erro: "Erro ao excluir." });
    }
};