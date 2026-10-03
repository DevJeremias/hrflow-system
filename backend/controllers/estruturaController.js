const db = require('../config/db');
const { departamentoDaEmpresa } = require('../utils/referenciasEmpresa');
const { responderErro } = require('../utils/erros');
const { limiteEDeslocamento, enviarPagina } = require('../utils/paginacao');

// ==========================================
// CRUD DE DEPARTAMENTOS
// ==========================================

exports.listarDepartamentos = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        const sql = `
            SELECT d.*,
                   COUNT(f.id) AS total_colaboradores,
                   COUNT(CASE WHEN f.status = 'Ativo' THEN 1 END) AS colaboradores_ativos,
                   (SELECT COUNT(*) FROM cargos c WHERE c.departamento_id = d.id AND c.empresa_id = d.empresa_id) AS total_cargos
            FROM departamentos d
            LEFT JOIN funcionarios f ON f.departamento_id = d.id AND f.empresa_id = d.empresa_id
            WHERE d.empresa_id = ?
            GROUP BY d.id
            ORDER BY d.id
            LIMIT ? OFFSET ?
        `;
        const [rows] = await db.query(sql, [empresa_id, ...limiteEDeslocamento(req.dadosValidados.query)]);
        const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM departamentos WHERE empresa_id = ?', [empresa_id]);
        enviarPagina(res, rows, total);
    } catch (error) {
        responderErro(res, error, "Erro ao buscar departamentos.");
    }
};

exports.criarDepartamento = async (req, res) => {
    const empresa_id = req.usuario.empresa_id;
    const { nome, sigla, descricao, gestor } = req.dadosValidados.body;

    try {
        const sql = 'INSERT INTO departamentos (nome, sigla, descricao, gestor, empresa_id) VALUES (?, ?, ?, ?, ?)';
        await db.query(sql, [nome, sigla, descricao, gestor, empresa_id]);
        res.status(201).json({ mensagem: "Departamento criado com sucesso!" });
    } catch (error) {
        responderErro(res, error, "Erro ao salvar o departamento.");
    }
};

exports.atualizarDepartamento = async (req, res) => {
    const { id } = req.dadosValidados.params;
    const empresa_id = req.usuario.empresa_id;
    const { nome, sigla, descricao, gestor } = req.dadosValidados.body;

    try {
        const sql = `
            UPDATE departamentos 
            SET nome = ?, sigla = ?, descricao = ?, gestor = ? 
            WHERE id = ? AND empresa_id = ?
        `;
        const [result] = await db.query(sql, [nome, sigla, descricao, gestor, id, empresa_id]);
        if (result.affectedRows === 0) return res.status(404).json({ erro: "Departamento não encontrado." });

        res.json({ mensagem: "Departamento atualizado com sucesso!" });
    } catch (error) {
        responderErro(res, error, "Erro ao modificar o departamento.");
    }
};

exports.deletarDepartamento = async (req, res) => {
    const { id } = req.dadosValidados.params;
    const empresa_id = req.usuario.empresa_id;

    try {
        const [[departamento]] = await db.query('SELECT id FROM departamentos WHERE id = ? AND empresa_id = ?', [id, empresa_id]);
        if (!departamento) return res.status(404).json({ erro: "Departamento não encontrado." });

        const [cargos] = await db.query('SELECT id FROM cargos WHERE departamento_id = ? AND empresa_id = ?', [id, empresa_id]);
        if (cargos.length > 0) {
            return res.status(400).json({ erro: "Não é possível excluir um departamento que possui cargos associados." });
        }

        const [result] = await db.query('DELETE FROM departamentos WHERE id = ? AND empresa_id = ?', [id, empresa_id]);
        if (result.affectedRows === 0) return res.status(404).json({ erro: "Departamento não encontrado." });

        res.json({ mensagem: "Departamento removido com sucesso!" });
    } catch (error) {
        responderErro(res, error, "Erro ao remover o departamento.");
    }
};

// ==========================================
// CRUD DE CARGOS
// ==========================================

exports.listarCargos = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        const sql = `
            SELECT c.*, d.nome as departamento_nome, d.sigla as departamento_sigla,
                   COUNT(f.id) AS ocupantes
            FROM cargos c
            LEFT JOIN departamentos d ON c.departamento_id = d.id AND d.empresa_id = c.empresa_id
            LEFT JOIN funcionarios f ON f.cargo_id = c.id AND f.empresa_id = c.empresa_id AND f.status = 'Ativo'
            WHERE c.empresa_id = ?
            GROUP BY c.id, d.nome, d.sigla
            ORDER BY c.id
            LIMIT ? OFFSET ?
        `;
        const [rows] = await db.query(sql, [empresa_id, ...limiteEDeslocamento(req.dadosValidados.query)]);
        const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM cargos WHERE empresa_id = ?', [empresa_id]);
        enviarPagina(res, rows, total);
    } catch (error) {
        responderErro(res, error, "Erro ao buscar cargos.");
    }
};

exports.criarCargo = async (req, res) => {
    const empresa_id = req.usuario.empresa_id;
    const { nome, departamento_id, nivel, salario_base } = req.dadosValidados.body;

    try {
        if (!(await departamentoDaEmpresa(db, departamento_id, empresa_id))) {
            return res.status(400).json({ erro: "Departamento não encontrado nesta empresa." });
        }

        const sql = 'INSERT INTO cargos (nome, departamento_id, nivel, salario_base, empresa_id) VALUES (?, ?, ?, ?, ?)';
        await db.query(sql, [nome, departamento_id, nivel, salario_base, empresa_id]);
        res.status(201).json({ mensagem: "Cargo estruturado com sucesso!" });
    } catch (error) {
        responderErro(res, error, "Erro ao salvar o cargo.");
    }
};

exports.atualizarCargo = async (req, res) => {
    const { id } = req.dadosValidados.params;
    const empresa_id = req.usuario.empresa_id;
    const { nome, departamento_id, nivel, salario_base } = req.dadosValidados.body;

    try {
        if (!(await departamentoDaEmpresa(db, departamento_id, empresa_id))) {
            return res.status(400).json({ erro: "Departamento não encontrado nesta empresa." });
        }

        const sql = 'UPDATE cargos SET nome = ?, departamento_id = ?, nivel = ?, salario_base = ? WHERE id = ? AND empresa_id = ?';
        const [result] = await db.query(sql, [nome, departamento_id, nivel, salario_base, id, empresa_id]);
        if (result.affectedRows === 0) return res.status(404).json({ erro: "Cargo não encontrado." });

        res.json({ mensagem: "Cargo modificado com sucesso!" });
    } catch (error) {
        responderErro(res, error, "Erro ao modificar o cargo.");
    }
};

exports.deletarCargo = async (req, res) => {
    const { id } = req.dadosValidados.params;
    const empresa_id = req.usuario.empresa_id;

    try {
        const [[cargo]] = await db.query('SELECT id FROM cargos WHERE id = ? AND empresa_id = ?', [id, empresa_id]);
        if (!cargo) return res.status(404).json({ erro: "Cargo não encontrado." });

        const [funcs] = await db.query('SELECT id FROM funcionarios WHERE cargo_id = ? AND empresa_id = ? AND status = "Ativo"', [id, empresa_id]);
        if (funcs.length > 0) {
            return res.status(400).json({ erro: "Não é possível remover este cargo porque existem colaboradores ativos alocados nele." });
        }

        const [result] = await db.query('DELETE FROM cargos WHERE id = ? AND empresa_id = ?', [id, empresa_id]);
        if (result.affectedRows === 0) return res.status(404).json({ erro: "Cargo não encontrado." });

        res.json({ mensagem: "Cargo removido com sucesso!" });
    } catch (error) {
        responderErro(res, error, "Erro ao remover o cargo.");
    }
};