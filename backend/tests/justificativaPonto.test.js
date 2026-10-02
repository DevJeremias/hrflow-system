// Requer MySQL real: o banco é criado e migrado por tests/support/bancoDeTeste.js
// (variáveis HRFLOW_TEST_DB_*). Sem HRFLOW_TEST_DB_HOST os testes são marcados como
// ignorados, nunca como aprovados.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const banco = require('./support/bancoDeTeste');
const { criarUsuario } = require('./support/sessao');

const db = require('../config/db');
const authMiddleware = require('../middlewares/authMiddleware');
const pontoRoutes = require('../routes/pontoRoutes');
const fuso = require('../utils/fusoPonto');

const semBanco = banco.skip;
const MES = '2026-03';
const DIA = '2026-03-10';
const OUTRO_DIA = '2026-03-11';

const ctx = {};
let servidor;
let baseUrl;

const novaEmpresa = async (nome) => {
    const [r] = await db.query('INSERT INTO empresas (nome) VALUES (?)', [nome]);
    return r.insertId;
};

const novoFuncionario = async (empresaId, nome, indice) => {
    const [r] = await db.query(
        `INSERT INTO funcionarios (nome, cpf, email, data_admissao, empresa_id) VALUES (?, ?, ?, '2024-01-02', ?)`,
        [nome, `000.000.000-0${indice}`, `funcionario${indice}@exemplo.invalid`, empresaId]
    );
    return r.insertId;
};

const chamar = async (metodo, caminho, token, corpo) => {
    const resposta = await fetch(`${baseUrl}${caminho}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { status: resposta.status, corpo: await resposta.json() };
};
const enviar = (dia, texto, token) => chamar('PUT', `/justificativa/${dia}`, token, { texto });
const consultar = (query, token) => chamar('GET', `/justificativas${query}`, token);
const linhasNoBanco = async (funcionarioId) =>
    (await db.query('SELECT COUNT(*) AS n FROM justificativas_ponto WHERE funcionario_id = ?', [funcionarioId]))[0][0].n;

test.before(async () => {
    if (semBanco) return;
    await banco.preparar();

    const sufixo = `${process.pid}-${Date.now()}`;
    ctx.empresaA = await novaEmpresa(`Empresa Ficticia A ${sufixo}`);
    ctx.empresaB = await novaEmpresa(`Empresa Ficticia B ${sufixo}`);
    ctx.rh = await novoFuncionario(ctx.empresaA, 'Rita RH Ficticia', 1);
    ctx.alvo = await novoFuncionario(ctx.empresaA, 'Caio Colaborador Ficticio', 2);
    ctx.outro = await novoFuncionario(ctx.empresaA, 'Dora Colaboradora Ficticia', 3);
    ctx.deOutraEmpresa = await novoFuncionario(ctx.empresaB, 'Eva Externa Ficticia', 4);

    await db.query(
        `INSERT INTO registro_pontos (funcionario_id, empresa_id, tipo_registro, data_hora_oficial) VALUES (?, ?, 'Entrada', ?)`,
        [ctx.alvo, ctx.empresaA, `${DIA} 12:00:00`]
    );

    const token = async (empresaId, perfil, funcionarioId) =>
        (await criarUsuario(db, { empresaId, perfil, funcionarioId })).token;
    ctx.tokenAlvo = await token(ctx.empresaA, 'Colaborador', ctx.alvo);
    ctx.tokenOutro = await token(ctx.empresaA, 'Colaborador', ctx.outro);
    ctx.tokenRH = await token(ctx.empresaA, 'RH', ctx.rh);
    ctx.tokenAdmin = await token(ctx.empresaA, 'Administrador', null);
    ctx.tokenOutraEmpresa = await token(ctx.empresaB, 'Colaborador', ctx.deOutraEmpresa);
    ctx.tokenRHOutraEmpresa = await token(ctx.empresaB, 'RH', null);

    const app = express();
    app.use(express.json());
    app.use('/api/ponto', authMiddleware, pontoRoutes);
    await new Promise((resolve) => { servidor = app.listen(0, '127.0.0.1', resolve); });
    baseUrl = `http://127.0.0.1:${servidor.address().port}/api/ponto`;
});

test.after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve));
    await db.end();
    if (!semBanco) await banco.encerrar();
});

test('o colaborador envia a justificativa e o servidor devolve o que gravou', { skip: semBanco }, async () => {
    const { status, corpo } = await enviar(DIA, '  Consulta médica com atestado.  ', ctx.tokenAlvo);
    assert.equal(status, 200);
    assert.equal(corpo.date, DIA);
    assert.equal(corpo.note, 'Consulta médica com atestado.');
    const [[linha]] = await db.query(
        `SELECT funcionario_id, empresa_id, DATE_FORMAT(data_referencia, '%Y-%m-%d') AS dia, texto
         FROM justificativas_ponto WHERE funcionario_id = ?`,
        [ctx.alvo]
    );
    assert.deepEqual({ ...linha }, {
        funcionario_id: ctx.alvo, empresa_id: ctx.empresaA, dia: DIA, texto: 'Consulta médica com atestado.',
    });
});

test('reenviar para o mesmo dia atualiza o texto sem duplicar', { skip: semBanco }, async () => {
    const { status, corpo } = await enviar(DIA, 'Texto corrigido.', ctx.tokenAlvo);
    assert.equal(status, 200);
    assert.equal(corpo.note, 'Texto corrigido.');
    assert.equal(await linhasNoBanco(ctx.alvo), 1);
});

test('o colaborador e a empresa vêm do token, não do corpo', { skip: semBanco }, async () => {
    const resposta = await chamar('PUT', `/justificativa/${OUTRO_DIA}`, ctx.tokenOutro, {
        texto: 'Minha justificativa.', funcionario_id: ctx.alvo, empresa_id: ctx.empresaB,
    });
    assert.equal(resposta.status, 200);
    const [[linha]] = await db.query(
        'SELECT funcionario_id, empresa_id FROM justificativas_ponto WHERE data_referencia = ?', [OUTRO_DIA]
    );
    assert.equal(linha.funcionario_id, ctx.outro);
    assert.equal(linha.empresa_id, ctx.empresaA);
    assert.equal(await linhasNoBanco(ctx.alvo), 1);
});

test('usuário sem vínculo de colaborador não envia justificativa', { skip: semBanco }, async () => {
    const { status } = await enviar(DIA, 'Sem vínculo.', ctx.tokenAdmin);
    assert.equal(status, 403);
});

test('o histórico do colaborador mostra a justificativa salva', { skip: semBanco }, async () => {
    const { status, corpo } = await chamar('GET', `/historico/${ctx.alvo}?mes=${MES}`, ctx.tokenAlvo);
    assert.equal(status, 200);
    assert.equal(corpo.find((d) => d.date === DIA).note, 'Texto corrigido.');
});

test('RH e Administrador consultam as justificativas da própria empresa', { skip: semBanco }, async () => {
    for (const token of [ctx.tokenRH, ctx.tokenAdmin]) {
        const { status, corpo } = await consultar(`?mes=${MES}`, token);
        assert.equal(status, 200);
        assert.deepEqual(
            corpo.map((j) => [j.date, j.funcionario_id, j.nome_funcionario, j.note]),
            [
                [OUTRO_DIA, ctx.outro, 'Dora Colaboradora Ficticia', 'Minha justificativa.'],
                [DIA, ctx.alvo, 'Caio Colaborador Ficticio', 'Texto corrigido.'],
            ]
        );
    }
});

test('a consulta filtra por colaborador e por mês', { skip: semBanco }, async () => {
    const porColaborador = await consultar(`?mes=${MES}&funcionarioId=${ctx.alvo}`, ctx.tokenRH);
    assert.deepEqual(porColaborador.corpo.map((j) => j.funcionario_id), [ctx.alvo]);
    const outroMes = await consultar('?mes=2026-04', ctx.tokenRH);
    assert.deepEqual(outroMes.corpo, []);
});

test('a consulta não vaza justificativas de outra empresa', { skip: semBanco }, async () => {
    await enviar(DIA, 'Justificativa da outra empresa.', ctx.tokenOutraEmpresa);
    const daOutra = await consultar(`?mes=${MES}`, ctx.tokenRHOutraEmpresa);
    assert.deepEqual(daOutra.corpo.map((j) => j.funcionario_id), [ctx.deOutraEmpresa]);
    const daEmpresaA = await consultar(`?mes=${MES}&funcionarioId=${ctx.deOutraEmpresa}`, ctx.tokenRH);
    assert.deepEqual(daEmpresaA.corpo, []);
});

test('colaborador não consulta justificativas', { skip: semBanco }, async () => {
    const { status } = await consultar(`?mes=${MES}`, ctx.tokenAlvo);
    assert.equal(status, 403);
});

test('a consulta exige o mês no formato AAAA-MM', { skip: semBanco }, async () => {
    for (const query of ['', '?mes=2026-13', '?mes=março']) {
        const { status } = await consultar(query, ctx.tokenRH);
        assert.equal(status, 400, query);
    }
});

test('entradas inválidas são recusadas com 400 e nada é gravado', { skip: semBanco }, async () => {
    const antes = await linhasNoBanco(ctx.alvo);
    const amanha = fuso.diaLocal(Math.floor(Date.now() / 1000) + 86400 * 2);
    const casos = [
        [DIA, ''],
        [DIA, '   '],
        [DIA, undefined],
        [DIA, 42],
        [DIA, 'x'.repeat(1001)],
        [DIA, 'com nulo \u0000'],
        ['2026-02-30', 'Data inexistente.'],
        ['ontem', 'Data em texto.'],
        [amanha, 'Dia futuro.'],
    ];
    for (const [dia, texto] of casos) {
        const { status, corpo } = await enviar(dia, texto, ctx.tokenAlvo);
        assert.equal(status, 400, `${dia} ${JSON.stringify(texto)}`);
        assert.equal(typeof corpo.erro, 'string');
    }
    assert.equal(await linhasNoBanco(ctx.alvo), antes);
});

test('o banco recusa justificativa cuja empresa não é a do colaborador', { skip: semBanco }, async () => {
    await assert.rejects(
        db.query(
            'INSERT INTO justificativas_ponto (empresa_id, funcionario_id, data_referencia, texto) VALUES (?, ?, ?, ?)',
            [ctx.empresaB, ctx.alvo, '2026-03-20', 'Empresa errada.']
        ),
        (erro) => erro.code === 'ER_NO_REFERENCED_ROW_2'
    );
});

test('sem token a rota recusa', { skip: semBanco }, async () => {
    const resposta = await fetch(`${baseUrl}/justificativa/${DIA}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: 'x' }),
    });
    assert.equal(resposta.status, 401);
});
