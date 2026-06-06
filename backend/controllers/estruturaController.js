const db = require('../config/db');

// ==========================================
// CRUD DE DEPARTAMENTOS
// ==========================================

exports.listarDepartamentos = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        const [rows] = await db.query('SELECT * FROM departamentos WHERE empresa_id = ?', [empresa_id]);
        res.json(rows);
    } catch (error) {
        console.error("Erro ao listar departamentos:", error);
        res.status(500).json({ erro: "Erro ao buscar departamentos." });
    }
};

exports.criarDepartamento = async (req, res) => {
    const empresa_id = req.usuario.empresa_id;
    const { nome, sigla, descricao, gestor } = req.body;

    if (!nome || !sigla) {
        return res.status(400).json({ erro: "Nome e sigla são campos obrigatórios." });
    }

    try {
        const sql = 'INSERT INTO departamentos (nome, sigla, descricao, gestor, empresa_id) VALUES (?, ?, ?, ?, ?)';
        await db.query(sql, [nome, sigla, descricao || null, gestor || null, empresa_id]);
        res.status(201).json({ mensagem: "Departamento criado com sucesso!" });
    } catch (error) {
        console.error("Erro ao criar departamento:", error);
        res.status(500).json({ erro: "Erro ao salvar o departamento." });
    }
};

exports.atualizarDepartamento = async (req, res) => {
    const { id } = req.params;
    const empresa_id = req.usuario.empresa_id;
    const { nome, sigla, descricao, gestor } = req.body;

    try {
        const sql = `
            UPDATE departamentos 
            SET nome = ?, sigla = ?, descricao = ?, gestor = ? 
            WHERE id = ? AND empresa_id = ?
        `;
        await db.query(sql, [nome, sigla, descricao || null, gestor || null, id, empresa_id]);
        res.json({ mensagem: "Departamento atualizado com sucesso!" });
    } catch (error) {
        console.error("Erro ao atualizar departamento:", error);
        res.status(500).json({ erro: "Erro ao modificar o departamento." });
    }
};

exports.deletarDepartamento = async (req, res) => {
    const { id } = req.params;
    const empresa_id = req.usuario.empresa_id;

    try {
        const [cargos] = await db.query('SELECT id FROM cargos WHERE departamento_id = ?', [id]);
        if (cargos.length > 0) {
            return res.status(400).json({ erro: "Não é possível excluir um departamento que possui cargos associados." });
        }

        const [result] = await db.query('DELETE FROM departamentos WHERE id = ? AND empresa_id = ?', [id, empresa_id]);
        if (result.affectedRows === 0) return res.status(404).json({ erro: "Departamento não encontrado." });

        res.json({ mensagem: "Departamento removido com sucesso!" });
    } catch (error) {
        console.error("Erro ao deletar departamento:", error);
        res.status(500).json({ erro: "Erro ao remover o departamento." });
    }
};

// ==========================================
// CRUD DE CARGOS
// ==========================================

exports.listarCargos = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        const sql = `
            SELECT c.*, d.nome as departamento_nome 
            FROM cargos c
            LEFT JOIN departamentos d ON c.departamento_id = d.id
            WHERE c.empresa_id = ?
        `;
        const [rows] = await db.query(sql, [empresa_id]);
        res.json(rows);
    } catch (error) {
        console.error("Erro ao listar cargos:", error);
        res.status(500).json({ erro: "Erro ao buscar cargos." });
    }
};

exports.criarCargo = async (req, res) => {
    const empresa_id = req.usuario.empresa_id;
    const { nome, departamento_id, nivel, salario_base } = req.body;

    if (!nome || !departamento_id) {
        return res.status(400).json({ erro: "Nome do cargo e departamento são obrigatórios." });
    }

    try {
        const sql = 'INSERT INTO cargos (nome, departamento_id, nivel, salario_base, empresa_id) VALUES (?, ?, ?, ?, ?)';
        await db.query(sql, [nome, departamento_id, nivel || null, salario_base || 0, empresa_id]);
        res.status(201).json({ mensagem: "Cargo estruturado com sucesso!" });
    } catch (error) {
        console.error("Erro ao criar cargo:", error);
        res.status(500).json({ erro: "Erro ao salvar o cargo." });
    }
};

exports.atualizarCargo = async (req, res) => {
    const { id } = req.params;
    const empresa_id = req.usuario.empresa_id;
    const { nome, departamento_id, nivel, salario_base } = req.body;

    try {
        const sql = 'UPDATE cargos SET nome = ?, departamento_id = ?, nivel = ?, salario_base = ? WHERE id = ? AND empresa_id = ?';
        await db.query(sql, [nome, departamento_id, nivel || null, salario_base || 0, id, empresa_id]);
        res.json({ mensagem: "Cargo modificado com sucesso!" });
    } catch (error) {
        console.error("Erro ao atualizar cargo:", error);
        res.status(500).json({ erro: "Erro ao modificar o cargo." });
    }
};

exports.deletarCargo = async (req, res) => {
    const { id } = req.params;
    const empresa_id = req.usuario.empresa_id;

    try {
        const [funcs] = await db.query('SELECT id FROM funcionarios WHERE cargo_id = ? AND status = "Ativo"', [id]);
        if (funcs.length > 0) {
            return res.status(400).json({ erro: "Não é possível remover este cargo porque existem colaboradores ativos alocados nele." });
        }

        await db.query('DELETE FROM cargos WHERE id = ? AND empresa_id = ?', [id, empresa_id]);
        res.json({ mensagem: "Cargo removido com sucesso!" });
    } catch (error) {
        console.error("Erro ao deletar cargo:", error);
        res.status(500).json({ erro: "Erro ao remover o cargo." });
    }
};