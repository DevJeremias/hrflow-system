// Regressão do SEC-05: cargo e departamento informados em cargos e funcionários
// precisam pertencer à empresa de quem opera.
//
// Exige um MySQL real, porque o defeito está na combinação entre os controllers e os JOINs.
// Informe o servidor (porta 3306, a única que o pool da API usa) com HRFLOW_TEST_DB_HOST,
// HRFLOW_TEST_DB_USER e HRFLOW_TEST_DB_PASS. O teste cria e apaga um banco próprio (hrflow_test_<pid>), sem tocar em
// DB_NAME. Sem HRFLOW_TEST_DB_HOST os testes são marcados como ignorados, nunca como aprovados.
const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const mysql = require('mysql2/promise');

const host = process.env.HRFLOW_TEST_DB_HOST;
const skip = host ? false : 'HRFLOW_TEST_DB_HOST não definido: sem MySQL, nada foi exercitado.';

const SCHEMA = [
    'CREATE TABLE empresas (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100) NOT NULL)',
    `CREATE TABLE departamentos (
        id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100) NOT NULL, sigla VARCHAR(10) NOT NULL,
        descricao TEXT, gestor VARCHAR(100), empresa_id INT NOT NULL)`,
    `CREATE TABLE cargos (
        id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100) NOT NULL, departamento_id INT,
        nivel VARCHAR(50), salario_base DECIMAL(10,2), empresa_id INT NOT NULL,
        FOREIGN KEY (departamento_id) REFERENCES departamentos(id))`,
    `CREATE TABLE funcionarios (
        id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100) NOT NULL, cpf VARCHAR(20),
        email VARCHAR(100) NOT NULL, telefone VARCHAR(20), data_admissao DATE NULL,
        data_nascimento DATE NULL, endereco TEXT NULL, banco VARCHAR(100) NULL,
        agencia VARCHAR(20) NULL, conta VARCHAR(20) NULL, tipo_conta VARCHAR(50) NULL, tipo_contrato VARCHAR(50) NULL, salario_base DECIMAL(10,2) NULL,
        cargo_id INT NULL, departamento_id INT NULL, status VARCHAR(20) DEFAULT 'Ativo',
        empresa_id INT NOT NULL,
        FOREIGN KEY (cargo_id) REFERENCES cargos(id),
        FOREIGN KEY (departamento_id) REFERENCES departamentos(id))`,
    `CREATE TABLE usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100), email VARCHAR(100) NOT NULL UNIQUE,
        senha VARCHAR(255) NOT NULL, perfil VARCHAR(50) NOT NULL, empresa_id INT NOT NULL,
        funcionario_id INT NULL, FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id))`,
];

describe('referências de cargo e departamento entre empresas', { skip }, () => {
    const dbName = `hrflow_test_${process.pid}`;
    const jwtSecret = crypto.randomBytes(16).toString('hex');
    let admin, server, baseUrl, pool;
    let empresaA, empresaB, deptoA, deptoB, cargoA, cargoB;

    const tokenDe = (empresa_id) => require('jsonwebtoken').sign(
        { id: 1, perfil: 'Administrador', empresa_id }, jwtSecret
    );

    const chamar = async (metodo, caminho, empresa_id, corpo) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenDe(empresa_id)}` },
            body: corpo ? JSON.stringify(corpo) : undefined,
        });
        return { status: resposta.status, corpo: await resposta.json() };
    };

    const inserir = async (sql, valores) => (await pool.query(sql, valores))[0].insertId;

    before(async () => {
        admin = await mysql.createConnection({
            host,
            user: process.env.HRFLOW_TEST_DB_USER,
            password: process.env.HRFLOW_TEST_DB_PASS,
        });
        await admin.query(`CREATE DATABASE \`${dbName}\``);
        await admin.query(`USE \`${dbName}\``);
        for (const sql of SCHEMA) await admin.query(sql);

        // O pool dos controllers lê estas variáveis ao ser carregado.
        process.env.DB_HOST = host;
        process.env.DB_USER = process.env.HRFLOW_TEST_DB_USER;
        process.env.DB_PASS = process.env.HRFLOW_TEST_DB_PASS;
        process.env.DB_NAME = dbName;
        process.env.JWT_SECRET = jwtSecret;
        pool = require('../config/db');

        const express = require('express');
        const authMiddleware = require('../middlewares/authMiddleware');
        const app = express();
        app.use(express.json());
        app.use('/api/estrutura', authMiddleware, require('../routes/estruturaRoutes'));
        app.use('/api/funcionarios', authMiddleware, require('../routes/funcionarioRoutes'));
        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;

        empresaA = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia A']);
        empresaB = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia B']);
        // Empresa B recebe linhas primeiro para que nenhum id de A coincida com um de B.
        deptoB = await inserir(
            'INSERT INTO departamentos (nome, sigla, empresa_id) VALUES (?, ?, ?)', ['Departamento Segredo B', 'SEB', empresaB]
        );
        cargoB = await inserir(
            'INSERT INTO cargos (nome, departamento_id, empresa_id) VALUES (?, ?, ?)', ['Cargo B', deptoB, empresaB]
        );
        deptoA = await inserir(
            'INSERT INTO departamentos (nome, sigla, empresa_id) VALUES (?, ?, ?)', ['Departamento A', 'DPA', empresaA]
        );
        cargoA = await inserir(
            'INSERT INTO cargos (nome, departamento_id, empresa_id) VALUES (?, ?, ?)', ['Cargo A', deptoA, empresaA]
        );
        assert.notEqual(deptoA, deptoB);
        assert.notEqual(cargoA, cargoB);
    });

    after(async () => {
        if (server) await new Promise((resolve) => server.close(resolve));
        if (pool) await pool.end();
        if (admin) {
            await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
            await admin.end();
        }
    });

    const contar = async (tabela, empresa_id) =>
        (await pool.query(`SELECT COUNT(*) AS total FROM ${tabela} WHERE empresa_id = ?`, [empresa_id]))[0][0].total;

    describe('cargos', () => {
        it('recusa criar cargo com departamento de outra empresa', async () => {
            const antes = await contar('cargos', empresaA);
            const { status } = await chamar('POST', '/api/estrutura/cargos', empresaA, {
                nome: 'Cargo Invasor', departamento_id: deptoB,
            });
            assert.equal(status, 400);
            assert.equal(await contar('cargos', empresaA), antes);
        });

        it('recusa criar cargo com departamento inexistente', async () => {
            const { status } = await chamar('POST', '/api/estrutura/cargos', empresaA, {
                nome: 'Cargo Fantasma', departamento_id: 999999,
            });
            assert.equal(status, 400);
        });

        it('recusa mover cargo para departamento de outra empresa', async () => {
            const { status } = await chamar('PUT', `/api/estrutura/cargos/${cargoA}`, empresaA, {
                nome: 'Cargo A', departamento_id: deptoB,
            });
            assert.equal(status, 400);
            const [[cargo]] = await pool.query('SELECT departamento_id FROM cargos WHERE id = ?', [cargoA]);
            assert.equal(cargo.departamento_id, deptoA);
        });

        it('aceita departamento da própria empresa e lista o nome correto', async () => {
            const criado = await chamar('POST', '/api/estrutura/cargos', empresaA, {
                nome: 'Cargo Legitimo', departamento_id: deptoA,
            });
            assert.equal(criado.status, 201);

            const { corpo } = await chamar('GET', '/api/estrutura/cargos', empresaA);
            const legitimo = corpo.find((cargo) => cargo.nome === 'Cargo Legitimo');
            assert.equal(legitimo.departamento_nome, 'Departamento A');
        });

        it('não expõe o nome de departamento de outra empresa em dado legado', async () => {
            const legado = await inserir(
                'INSERT INTO cargos (nome, departamento_id, empresa_id) VALUES (?, ?, ?)', ['Cargo Legado', deptoB, empresaA]
            );
            const { corpo } = await chamar('GET', '/api/estrutura/cargos', empresaA);
            const cargo = corpo.find((item) => item.id === legado);
            assert.equal(cargo.departamento_nome, null);
            assert.ok(!JSON.stringify(corpo).includes('Departamento Segredo B'));
        });
    });

    describe('funcionários', () => {
        const base = (sufixo) => ({
            nome: `Pessoa Ficticia ${sufixo}`, email: `pessoa.${sufixo}@exemplo.invalid`, senha: 'senha-ficticia',
        });

        it('recusa criar colaborador com cargo de outra empresa', async () => {
            const [funcionarios, usuarios] = [await contar('funcionarios', empresaA), await contar('usuarios', empresaA)];
            const { status } = await chamar('POST', '/api/funcionarios', empresaA, {
                ...base('cargo-b'), cargo_id: cargoB,
            });
            assert.equal(status, 400);
            assert.equal(await contar('funcionarios', empresaA), funcionarios);
            assert.equal(await contar('usuarios', empresaA), usuarios);
        });

        it('recusa criar colaborador com departamento de outra empresa', async () => {
            const [funcionarios, usuarios] = [await contar('funcionarios', empresaA), await contar('usuarios', empresaA)];
            const { status } = await chamar('POST', '/api/funcionarios', empresaA, {
                ...base('depto-b'), departamento_id: deptoB,
            });
            assert.equal(status, 400);
            assert.equal(await contar('funcionarios', empresaA), funcionarios);
            assert.equal(await contar('usuarios', empresaA), usuarios);
        });

        it('aceita colaborador sem cargo e sem departamento', async () => {
            const { status } = await chamar('POST', '/api/funcionarios', empresaA, base('sem-ref'));
            assert.equal(status, 201);
        });

        it('aceita colaborador com cargo e departamento da própria empresa', async () => {
            const { status } = await chamar('POST', '/api/funcionarios', empresaA, {
                ...base('proprio'), cargo_id: cargoA, departamento_id: deptoA,
            });
            assert.equal(status, 201);

            const { corpo } = await chamar('GET', '/api/funcionarios', empresaA);
            const pessoa = corpo.find((item) => item.email === 'pessoa.proprio@exemplo.invalid');
            assert.equal(pessoa.cargo_nome, 'Cargo A');
            assert.equal(pessoa.departamento_nome, 'Departamento A');
        });

        it('recusa atualizar colaborador para cargo ou departamento de outra empresa', async () => {
            const id = await inserir(
                'INSERT INTO funcionarios (nome, email, cargo_id, departamento_id, empresa_id) VALUES (?, ?, ?, ?, ?)',
                ['Pessoa Ficticia Edicao', 'pessoa.edicao@exemplo.invalid', cargoA, deptoA, empresaA]
            );
            const corpo = { nome: 'Pessoa Ficticia Edicao', email: 'pessoa.edicao@exemplo.invalid' };

            const cargo = await chamar('PUT', `/api/funcionarios/${id}`, empresaA, { ...corpo, cargo_id: cargoB, departamento_id: deptoA });
            const depto = await chamar('PUT', `/api/funcionarios/${id}`, empresaA, { ...corpo, cargo_id: cargoA, departamento_id: deptoB });
            assert.equal(cargo.status, 400);
            assert.equal(depto.status, 400);

            const [[pessoa]] = await pool.query('SELECT cargo_id, departamento_id FROM funcionarios WHERE id = ?', [id]);
            assert.equal(pessoa.cargo_id, cargoA);
            assert.equal(pessoa.departamento_id, deptoA);
        });

        it('não expõe nomes de outra empresa em dado legado', async () => {
            await inserir(
                'INSERT INTO funcionarios (nome, email, cargo_id, departamento_id, empresa_id) VALUES (?, ?, ?, ?, ?)',
                ['Pessoa Ficticia Legado', 'pessoa.legado@exemplo.invalid', cargoB, deptoB, empresaA]
            );
            const { corpo } = await chamar('GET', '/api/funcionarios', empresaA);
            const pessoa = corpo.find((item) => item.email === 'pessoa.legado@exemplo.invalid');
            assert.equal(pessoa.cargo_nome, null);
            assert.equal(pessoa.departamento_nome, null);
        });
    });
});
