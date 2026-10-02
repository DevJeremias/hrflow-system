// Requer MySQL real: o banco é criado e migrado por tests/support/bancoDeTeste.js
// (variáveis HRFLOW_TEST_DB_*). Sem HRFLOW_TEST_DB_HOST os testes são marcados como
// ignorados, nunca como aprovados.
// O perfil tem uma única API (/api/perfil): a mesma resposta para Administrador, RH e Colaborador.
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const express = require('express');
const banco = require('./support/bancoDeTeste');
const { criarUsuario } = require('./support/sessao');
const { dataUrl } = require('./support/imagens');

const db = require('../config/db');
const authMiddleware = require('../middlewares/authMiddleware');
const tratarErros = require('../middlewares/tratarErros');
const perfilRoutes = require('../routes/perfilRoutes');
const authRoutes = require('../routes/authRoutes');

const semBanco = banco.skip;

const ctx = {};
let servidor;
let baseUrl;

const chamar = async (metodo, caminho, token, corpo) => {
    const resposta = await fetch(`${baseUrl}${caminho}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: corpo ? JSON.stringify(corpo) : undefined,
    });
    return { status: resposta.status, corpo: await resposta.json() };
};

const inserir = async (sql, valores) => (await db.query(sql, valores))[0].insertId;

test.before(async () => {
    if (semBanco) return;
    await banco.preparar();

    const sufixo = `${process.pid}-${Date.now()}`;
    ctx.empresaA = await inserir('INSERT INTO empresas (nome) VALUES (?)', [`Empresa Ficticia A ${sufixo}`]);
    ctx.empresaB = await inserir('INSERT INTO empresas (nome) VALUES (?)', [`Empresa Ficticia B ${sufixo}`]);

    const [[{ departamento }]] = await db.query('SELECT MIN(id) AS departamento FROM departamentos WHERE empresa_id = ?', [ctx.empresaA]);
    ctx.cargo = await inserir('INSERT INTO cargos (nome, nivel, departamento_id, empresa_id) VALUES (?, ?, ?, ?)', ['Analista Ficticio', 'Pleno', departamento, ctx.empresaA]);
    ctx.departamento = departamento;
    const [[{ nome: nomeDepartamento }]] = await db.query('SELECT nome FROM departamentos WHERE id = ?', [departamento]);
    ctx.nomeDepartamento = nomeDepartamento;

    ctx.funcionario = await inserir(
        `INSERT INTO funcionarios (nome, cpf, email, telefone, data_admissao, data_nascimento, tipo_contrato, banco, agencia, conta, tipo_conta, cargo_id, departamento_id, empresa_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['Caio Colaborador Ficticio', '000.000.000-02', 'caio.perfil@exemplo.invalid', '(00) 90000-0000', '2024-03-04', '1991-07-20', 'CLT',
            'Banco Ficticio', '0001', '00000-1', 'Corrente', ctx.cargo, departamento, ctx.empresaA]
    );
    ctx.funcionarioDeOutraEmpresa = await inserir(
        'INSERT INTO funcionarios (nome, cpf, email, banco, empresa_id) VALUES (?, ?, ?, ?, ?)',
        ['Eva Externa Ficticia', '000.000.000-04', 'eva.perfil@exemplo.invalid', 'Banco Alheio Ficticio', ctx.empresaB]
    );

    ctx.colaborador = await criarUsuario(db, { empresaId: ctx.empresaA, perfil: 'Colaborador', funcionarioId: ctx.funcionario });
    ctx.admin = await criarUsuario(db, { empresaId: ctx.empresaA, perfil: 'Administrador' });
    ctx.cruzado = await criarUsuario(db, { empresaId: ctx.empresaA, perfil: 'Colaborador' });

    const app = express();
    app.use('/api/auth', authRoutes);
    app.use(express.json({ limit: '4mb' }));
    app.use('/api/perfil', authMiddleware, perfilRoutes);
    app.use(tratarErros);
    await new Promise((resolve) => { servidor = app.listen(0, '127.0.0.1', resolve); });
    baseUrl = `http://127.0.0.1:${servidor.address().port}/api`;
});

test.after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve));
    await db.end();
    if (!semBanco) await banco.encerrar();
});

test('o colaborador recebe dados pessoais, vínculo, contrato e dados bancários na mesma resposta', { skip: semBanco }, async () => {
    const { status, corpo } = await chamar('GET', '/perfil/meus-dados', ctx.colaborador.token);
    assert.equal(status, 200);
    assert.deepEqual(corpo, {
        perfil: 'Colaborador',
        nome: 'Caio Colaborador Ficticio',
        email: ctx.colaborador.usuario.email,
        avatar: null,
        telefone: '(00) 90000-0000',
        cpf: '000.000.000-02',
        data_nascimento: '1991-07-20',
        data_admissao: '2024-03-04',
        endereco: null,
        tipo_contrato: 'CLT',
        nivel: 'Pleno',
        banco: 'Banco Ficticio',
        agencia: '0001',
        conta: '00000-1',
        tipo_conta: 'Corrente',
        cargo: 'Analista Ficticio',
        departamento: ctx.nomeDepartamento,
        vinculado: true,
    });
});

test('o administrador, que não tem funcionário, recebe a mesma forma de resposta com os campos do vínculo vazios', { skip: semBanco }, async () => {
    const { status, corpo } = await chamar('GET', '/perfil/meus-dados', ctx.admin.token);
    assert.equal(status, 200);
    assert.equal(corpo.perfil, 'Administrador');
    assert.equal(corpo.vinculado, false);
    assert.equal(corpo.nome, ctx.admin.usuario.nome);
    assert.equal(corpo.email, ctx.admin.usuario.email);
    assert.equal(corpo.cargo, 'Gestão do Sistema');
    assert.equal(corpo.departamento, 'Administração');
    for (const campo of ['telefone', 'cpf', 'data_admissao', 'tipo_contrato', 'banco', 'agencia', 'conta']) {
        assert.equal(corpo[campo], null, campo);
    }
});

test('o avatar gravado volta no perfil e na sessão, para o administrador e para o colaborador', { skip: semBanco }, async () => {
    for (const quem of [ctx.admin, ctx.colaborador]) {
        const avatar = dataUrl('png', 1024);
        const { usuario } = quem;
        const salvo = await chamar('PUT', '/perfil/meus-dados', quem.token, {
            nome: usuario.nome, email: usuario.email, telefone: '', avatar,
        });
        assert.equal(salvo.status, 200, usuario.perfil);

        assert.equal((await chamar('GET', '/perfil/meus-dados', quem.token)).corpo.avatar, avatar, usuario.perfil);
        assert.equal((await chamar('GET', '/auth/sessao', quem.token)).corpo.avatar, avatar, usuario.perfil);
    }
});

test('o banco recusa vincular usuário e funcionário de empresas diferentes', { skip: semBanco }, async () => {
    await assert.rejects(
        db.query(
            'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, funcionario_id) VALUES (?, ?, ?, ?, ?, ?)',
            ['Usuário Cruzado Fictício', 'cruzado.insert@exemplo.invalid', 'hash-ficticio', 'Colaborador', ctx.empresaA, ctx.funcionarioDeOutraEmpresa]
        ),
        { code: 'ER_NO_REFERENCED_ROW_2' }
    );
});

test('login, sessão e atualização de perfil não acessam funcionário de outra empresa mesmo com vínculo legado inconsistente', { skip: semBanco }, async () => {
    const senha = 'senha-ficticia-regressao';
    const hash = await bcrypt.hash(senha, 4);
    const connection = await db.getConnection();
    try {
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.query('UPDATE usuarios SET funcionario_id = ?, senha = ? WHERE id = ?', [
            ctx.funcionarioDeOutraEmpresa, hash, ctx.cruzado.usuario.id,
        ]);
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        connection.release();
    }

    const login = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ctx.cruzado.usuario.email, senha }),
    });
    const credencial = await login.json();
    assert.equal(login.status, 200);
    assert.equal(credencial.nome, ctx.cruzado.usuario.nome);

    const sessao = await chamar('GET', '/auth/sessao', credencial.token);
    assert.equal(sessao.status, 200);
    assert.equal(sessao.corpo.nome, ctx.cruzado.usuario.nome);

    const perfil = await chamar('GET', '/perfil/meus-dados', credencial.token);
    assert.equal(perfil.status, 200);
    assert.equal(perfil.corpo.vinculado, false);
    assert.equal(perfil.corpo.banco, null);
    assert.notEqual(perfil.corpo.nome, 'Eva Externa Ficticia');

    const atualizacao = await chamar('PUT', '/perfil/meus-dados', credencial.token, {
        nome: 'Nome Atualizado Fictício', email: ctx.cruzado.usuario.email, telefone: '0000000000', avatar: null,
    });
    assert.equal(atualizacao.status, 200);
    const [[funcionario]] = await db.query('SELECT nome, telefone, banco FROM funcionarios WHERE id = ?', [ctx.funcionarioDeOutraEmpresa]);
    assert.deepEqual(funcionario, { nome: 'Eva Externa Ficticia', telefone: null, banco: 'Banco Alheio Ficticio' });
});
