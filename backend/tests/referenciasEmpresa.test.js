// Regressão do SEC-05: cargo e departamento informados em cargos e funcionários
// precisam pertencer à empresa de quem opera.
//
// Exige um MySQL real, porque o defeito está na combinação entre os controllers e os JOINs.
// O banco é criado e migrado por tests/support/bancoDeTeste.js (variáveis HRFLOW_TEST_DB_*).
const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const banco = require('./support/bancoDeTeste');
const { criarUsuario, cabecalhosDaSessao } = require('./support/sessao');

describe('referências de cargo e departamento entre empresas', { skip: banco.skip }, () => {
    let server, baseUrl, pool;
    let empresaA, empresaB, deptoA, deptoB, cargoA, cargoB;

    const tokens = {};
    const tokenDe = (empresa_id) => tokens[empresa_id];

    const chamar = async (metodo, caminho, empresa_id, corpo) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(tokenDe(empresa_id)) },
            body: corpo ? JSON.stringify(corpo) : undefined,
        });
        return { status: resposta.status, corpo: await resposta.json() };
    };

    const inserir = async (sql, valores) => (await pool.query(sql, valores))[0].insertId;

    // Simula dado contaminado, que o banco migrado recusa: só entra com a checagem de chaves desligada.
    const inserirLegado = async (sql, valores) => {
        const conexao = await pool.getConnection();
        try {
            await conexao.query('SET FOREIGN_KEY_CHECKS = 0');
            return (await conexao.query(sql, valores))[0].insertId;
        } finally {
            await conexao.query('SET FOREIGN_KEY_CHECKS = 1');
            conexao.release();
        }
    };

    before(async () => {
        await banco.preparar();
        pool = require('../config/db');

        const express = require('express');
        const authMiddleware = require('../middlewares/authMiddleware');
        const app = express();
        app.use(express.json());
        app.use('/api/estrutura', authMiddleware, require('../routes/estruturaRoutes'));
        app.use('/api/funcionarios', authMiddleware, require('../modules/funcionarios/index.ts').funcionariosRoutes);
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
        for (const empresaId of [empresaA, empresaB]) {
            tokens[empresaId] = (await criarUsuario(pool, { empresaId, perfil: 'Administrador' })).token;
        }
        assert.notEqual(deptoA, deptoB);
        assert.notEqual(cargoA, cargoB);
    });

    after(async () => {
        if (server) await new Promise((resolve) => server.close(resolve));
        if (pool) await pool.end();
        await banco.encerrar();
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
            const legado = await inserirLegado(
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
            await inserirLegado(
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
