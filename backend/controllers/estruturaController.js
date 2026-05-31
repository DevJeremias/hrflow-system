const db = require('../config/db');

// ==========================================
// DEPARTAMENTOS
// ==========================================
exports.listarDepartamentos = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        
        // Esta query traz os departamentos e já conta os cargos e colaboradores de cada um!
        const sql = `
            SELECT d.id, d.nome as name, d.sigla, d.descricao as description, d.gestor as manager,
            (SELECT COUNT(*) FROM cargos c WHERE c.departamento_id = d.id) as rolesCount,
            (SELECT COUNT(*) FROM funcionarios f WHERE f.departamento_id = d.id) as collaborators,
            (SELECT COUNT(*) FROM funcionarios f WHERE f.departamento_id = d.id AND f.status = 'Ativo') as active
            FROM departamentos d
            WHERE d.empresa_id = ?
        `;
        const [rows] = await db.query(sql, [empresa_id]);
        res.json(rows);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao buscar departamentos.' });
    }
};

exports.salvarDepartamento = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        const { id, name, sigla, description, manager } = req.body;

        if (id) {
            await db.query(
                'UPDATE departamentos SET nome=?, sigla=?, descricao=?, gestor=? WHERE id=? AND empresa_id=?',
                [name, sigla || '', description || '', manager || '', id, empresa_id]
            );
            return res.json({ id, name, sigla, description, manager });
        } else {
            const [result] = await db.query(
                'INSERT INTO departamentos (nome, sigla, descricao, gestor, empresa_id) VALUES (?, ?, ?, ?, ?)',
                [name, sigla || '', description || '', manager || '', empresa_id]
            );
            return res.status(201).json({ id: result.insertId.toString(), name, sigla, description, manager });
        }
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao salvar departamento.' });
    }
};

// ==========================================
// CARGOS
// ==========================================
exports.listarCargos = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        
        const sql = `
            SELECT c.id, c.nome as title, c.nivel as level, c.salario_base as salary,
            d.sigla as deptSigla, d.id as departamento_id,
            (SELECT COUNT(*) FROM funcionarios f WHERE f.cargo_id = c.id) as occupants
            FROM cargos c
            LEFT JOIN departamentos d ON c.departamento_id = d.id
            WHERE c.empresa_id = ?
        `;
        const [rows] = await db.query(sql, [empresa_id]);
        res.json(rows);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao buscar cargos.' });
    }
};

exports.salvarCargo = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        // O Front-end manda 'title', nós guardamos como 'nome'
        const { id, title, level, salary, departamento_id } = req.body;
        
        if (id) {
            await db.query(
                'UPDATE cargos SET nome=?, nivel=?, salario_base=?, departamento_id=? WHERE id=? AND empresa_id=?',
                [title, level, salary, departamento_id, id, empresa_id]
            );
            return res.json({ id, title });
        } else {
            const [result] = await db.query(
                'INSERT INTO cargos (nome, nivel, salario_base, departamento_id, empresa_id) VALUES (?, ?, ?, ?, ?)',
                [title, level, salary, departamento_id, empresa_id]
            );
            return res.status(201).json({ id: result.insertId.toString(), title });
        }
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao salvar cargo.' });
    }
};