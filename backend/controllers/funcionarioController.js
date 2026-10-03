const db = require('../config/db');
const bcrypt = require('bcrypt');
const { cargoDaEmpresa, departamentoDaEmpresa } = require('../utils/referenciasEmpresa');
const { responderErro, EMAIL_DUPLICADO } = require('../utils/erros');
const { limiteEDeslocamento, enviarPagina } = require('../utils/paginacao');

// Devolve a mensagem de erro quando cargo ou departamento informado não é da empresa.
const validarReferencias = async (executor, cargo_id, departamento_id, empresa_id) => {
    if (cargo_id && !(await cargoDaEmpresa(executor, cargo_id, empresa_id))) {
        return "Cargo não encontrado nesta empresa.";
    }
    if (departamento_id && !(await departamentoDaEmpresa(executor, departamento_id, empresa_id))) {
        return "Departamento não encontrado nesta empresa.";
    }
    return null;
};

exports.listarFuncionarios = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        const sql = `
            SELECT f.*, c.nome as cargo_nome, d.nome as departamento_nome 
            FROM funcionarios f
            LEFT JOIN cargos c ON f.cargo_id = c.id AND c.empresa_id = f.empresa_id
            LEFT JOIN departamentos d ON f.departamento_id = d.id AND d.empresa_id = f.empresa_id
            WHERE f.empresa_id = ?
            ORDER BY f.id
            LIMIT ? OFFSET ?
        `;
        const [rows] = await db.query(sql, [empresa_id, ...limiteEDeslocamento(req.dadosValidados.query)]);
        const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM funcionarios WHERE empresa_id = ?', [empresa_id]);
        enviarPagina(res, rows, total);
    } catch (error) {
        responderErro(res, error, "Erro ao buscar funcionários.");
    }
};

exports.criarFuncionario = async (req, res) => {
    const empresa_id = req.usuario.empresa_id; 
    
    const { 
        nome, cpf, email, telefone, data_admissao, data_nascimento, 
        endereco, banco, agencia, conta, tipo_conta, 
        nivel, cargo_id, departamento_id, tipo_contrato, salario_base, senha 
    } = req.dadosValidados.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const erroReferencia = await validarReferencias(connection, cargo_id, departamento_id, empresa_id);
        if (erroReferencia) {
            await connection.rollback();
            return res.status(400).json({ erro: erroReferencia });
        }

        const [usuarioExistente] = await connection.query(
            'SELECT id FROM usuarios WHERE email = ?', [email]
        );
        if (usuarioExistente.length > 0) {
            await connection.rollback();
            return res.status(400).json({ erro: EMAIL_DUPLICADO, detalhes: [{ campo: 'email', mensagem: EMAIL_DUPLICADO }] });
        }

        const sqlFuncionario = `
            INSERT INTO funcionarios (
                nome, cpf, email, telefone, data_admissao, data_nascimento, 
                endereco, banco, agencia, conta, tipo_conta, nivel, cargo_id, 
                departamento_id, tipo_contrato, salario_base, status, empresa_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ativo', ?)
        `;
        
        const [resultFunc] = await connection.query(sqlFuncionario, [
            nome, cpf, email, telefone, data_admissao, 
            data_nascimento, endereco, banco, agencia, 
            conta, tipo_conta, nivel, cargo_id, departamento_id, 
            tipo_contrato, salario_base, empresa_id
        ]);

        const funcionarioId = resultFunc.insertId;

        const saltRounds = 10;
        const senhaCriptografada = await bcrypt.hash(senha, saltRounds);

        // CORREÇÃO CRÍTICA: Inserindo o campo 'nome' na tabela usuarios
        const sqlUsuario = `
            INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, funcionario_id)
            VALUES (?, ?, ?, 'Colaborador', ?, ?)
        `;
        await connection.query(sqlUsuario, [nome, email, senhaCriptografada, empresa_id, funcionarioId]);

        await connection.commit();
        res.status(201).json({ mensagem: "Colaborador e credenciais de acesso criados com sucesso!" });

    } catch (error) {
        await connection.rollback();
        responderErro(res, error, "Erro interno ao processar o cadastro.");
    } finally {
        connection.release();
    }
};

exports.atualizarFuncionario = async (req, res) => {
    const { id } = req.dadosValidados.params;
    const empresa_id = req.usuario.empresa_id;
    const { 
        nome, cpf, email, telefone, data_admissao, data_nascimento, 
        endereco, banco, agencia, conta, tipo_conta,
        nivel, cargo_id, departamento_id, tipo_contrato, salario_base, status 
    } = req.dadosValidados.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const erroReferencia = await validarReferencias(connection, cargo_id, departamento_id, empresa_id);
        if (erroReferencia) {
            await connection.rollback();
            return res.status(400).json({ erro: erroReferencia });
        }

        const sql = `
            UPDATE funcionarios 
            SET nome = ?, cpf = ?, email = ?, telefone = ?, data_admissao = ?, data_nascimento = ?, 
                endereco = ?, banco = ?, agencia = ?, conta = ?, tipo_conta = ?, nivel = ?, cargo_id = ?, 
                departamento_id = ?, tipo_contrato = ?, salario_base = ?, status = ?
            WHERE id = ? AND empresa_id = ?
        `;
        
        const [result] = await connection.query(sql, [
            nome, cpf, email, telefone, data_admissao, data_nascimento, 
            endereco, banco, agencia, conta, tipo_conta,
            nivel, cargo_id, departamento_id, tipo_contrato, salario_base, 
            status, id, empresa_id
        ]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ erro: "Funcionário não encontrado." });
        }

        // Sincroniza o e-mail e o nome atualizado na tabela de credenciais
        await connection.query('UPDATE usuarios SET email = ?, nome = ? WHERE funcionario_id = ? AND empresa_id = ?', [email, nome, id, empresa_id]);

        // Inativar derruba as sessões abertas; sem isso, reativar ressuscitaria tokens antigos.
        if (status === 'Inativo') {
            await connection.query('UPDATE usuarios SET sessao_versao = sessao_versao + 1 WHERE funcionario_id = ? AND empresa_id = ?', [id, empresa_id]);
        }

        await connection.commit();
        res.json({ mensagem: "Funcionário atualizado com sucesso!" });
    } catch (error) {
        await connection.rollback();
        responderErro(res, error, "Erro ao modificar o funcionário.");
    } finally {
        connection.release();
    }
};

exports.deletarFuncionario = async (req, res) => {
    const { id } = req.dadosValidados.params;
    const empresa_id = req.usuario.empresa_id;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query('DELETE FROM usuarios WHERE funcionario_id = ? AND empresa_id = ?', [id, empresa_id]);

        const [result] = await connection.query('DELETE FROM funcionarios WHERE id = ? AND empresa_id = ?', [id, empresa_id]);
        
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ erro: "Funcionário não encontrado." });
        }

        await connection.commit();
        res.json({ mensagem: "Funcionário removido com sucesso!" });
    } catch (error) {
        await connection.rollback();
        responderErro(res, error, "Erro ao remover o funcionário.");
    } finally {
        connection.release();
    }
};