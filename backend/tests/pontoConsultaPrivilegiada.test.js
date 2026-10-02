// Requer MySQL real: o banco é criado e migrado por tests/support/bancoDeTeste.js
// (variáveis HRFLOW_TEST_DB_*). Sem HRFLOW_TEST_DB_HOST os testes são marcados como
// ignorados, nunca como aprovados.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const banco = require('./support/bancoDeTeste');
const { criarUsuario, cabecalhosDaSessao } = require('./support/sessao');

const db = require('../config/db');
const authMiddleware = require('../middlewares/authMiddleware');
const { pontoRoutes } = require('../modules/ponto/index.ts');
const { relogio } = require('../modules/ponto/ponto.service.ts');
const fuso = require('../modules/ponto/ponto.fuso.ts');

const semBanco = banco.skip;
const MES = '2026-03';
const DIA = '2026-03-10';

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

const novoPonto = (funcionarioId, empresaId, tipo, dataHora) =>
    db.query(
        'INSERT INTO registro_pontos (funcionario_id, empresa_id, tipo_registro, data_hora_oficial) VALUES (?, ?, ?, ?)',
        [funcionarioId, empresaId, tipo, dataHora]
    );

// "Hoje" é o dia de Belém no instante fixado aqui, para o teste não atravessar a virada do dia.
const AGORA = Math.floor(Date.now() / 1000);
const novoPontoHoje = (funcionarioId, empresaId, tipo, hora) =>
    db.query(
        'INSERT INTO registro_pontos (funcionario_id, empresa_id, tipo_registro, data_hora_oficial) VALUES (?, ?, ?, FROM_UNIXTIME(?))',
        [funcionarioId, empresaId, tipo, fuso.limitesDoDia(fuso.diaLocal(AGORA)).inicio + hora * 3600]
    );

const get = async (caminho, token) => {
    const resposta = await fetch(`${baseUrl}${caminho}`, { headers: { ...cabecalhosDaSessao(token) } });
    return { status: resposta.status, corpo: await resposta.json() };
};

test.before(async () => {
    if (semBanco) return;
    relogio.agora = () => AGORA * 1000;
    await banco.preparar();

    const sufixo = `${process.pid}-${Date.now()}`;
    ctx.empresaA = await novaEmpresa(`Empresa Ficticia A ${sufixo}`);
    ctx.empresaB = await novaEmpresa(`Empresa Ficticia B ${sufixo}`);

    // Ids distintos por construção: cada funcionário é inserido em sequência.
    ctx.rh = await novoFuncionario(ctx.empresaA, 'Rita RH Ficticia', 1);
    ctx.alvo = await novoFuncionario(ctx.empresaA, 'Caio Colaborador Ficticio', 2);
    ctx.outro = await novoFuncionario(ctx.empresaA, 'Dora Colaboradora Ficticia', 3);
    ctx.deOutraEmpresa = await novoFuncionario(ctx.empresaB, 'Eva Externa Ficticia', 4);

    // Alvo: Entrada e Saída. Solicitante RH: apenas Pausa Almoço. Os dois conjuntos nunca coincidem.
    await novoPontoHoje(ctx.alvo, ctx.empresaA, 'Entrada', 8);
    await novoPontoHoje(ctx.alvo, ctx.empresaA, 'Saída', 17);
    await novoPontoHoje(ctx.rh, ctx.empresaA, 'Pausa Almoço', 12);
    await novoPontoHoje(ctx.deOutraEmpresa, ctx.empresaB, 'Retorno Almoço', 13);
    await novoPonto(ctx.alvo, ctx.empresaA, 'Entrada', `${DIA} 08:00:00`);
    await novoPonto(ctx.alvo, ctx.empresaA, 'Saída', `${DIA} 17:00:00`);
    await novoPonto(ctx.rh, ctx.empresaA, 'Pausa Almoço', `${MES}-11 12:00:00`);
    await novoPonto(ctx.deOutraEmpresa, ctx.empresaB, 'Entrada', `${MES}-12 09:00:00`);

    ctx.tokenRH = (await criarUsuario(db, { empresaId: ctx.empresaA, perfil: 'RH', funcionarioId: ctx.rh })).token;
    ctx.tokenAdmin = (await criarUsuario(db, { empresaId: ctx.empresaA, perfil: 'Administrador' })).token;
    ctx.tokenColaborador = (await criarUsuario(db, { empresaId: ctx.empresaA, perfil: 'Colaborador', funcionarioId: ctx.alvo })).token;

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

const tipos = (lista) => lista.map((p) => p.type).sort();

test('ids de teste são distintos por construção', { skip: semBanco }, () => {
    assert.equal(new Set([ctx.rh, ctx.alvo, ctx.outro, ctx.deOutraEmpresa]).size, 4);
});

test('RH consulta os pontos de hoje do colaborador pedido, não os próprios', { skip: semBanco }, async () => {
    const { status, corpo } = await get(`/hoje/${ctx.alvo}`, ctx.tokenRH);
    assert.equal(status, 200);
    assert.deepEqual(tipos(corpo), ['Entrada', 'Saída']);
});

test('Administrador sem vínculo de funcionário consulta os pontos de hoje do colaborador', { skip: semBanco }, async () => {
    const { status, corpo } = await get(`/hoje/${ctx.alvo}`, ctx.tokenAdmin);
    assert.equal(status, 200);
    assert.deepEqual(tipos(corpo), ['Entrada', 'Saída']);
});

test('RH consulta o histórico do colaborador pedido, não o próprio', { skip: semBanco }, async () => {
    const { status, corpo } = await get(`/historico/${ctx.alvo}?mes=${MES}`, ctx.tokenRH);
    assert.equal(status, 200);
    assert.deepEqual(corpo.map((d) => d.date), [DIA]);
    assert.notEqual(corpo[0].entry, '--:--');
    assert.notEqual(corpo[0].exit, '--:--');
    assert.equal(corpo[0].lunchOut, '--:--');
});

test('Administrador sem vínculo consulta o histórico do colaborador', { skip: semBanco }, async () => {
    const { status, corpo } = await get(`/historico/${ctx.alvo}?mes=${MES}`, ctx.tokenAdmin);
    assert.equal(status, 200);
    assert.deepEqual(corpo.map((d) => d.date), [DIA]);
});

test('o filtro por empresa continua valendo para perfis privilegiados', { skip: semBanco }, async () => {
    const usuario = ctx.tokenRH;
    const hoje = await get(`/hoje/${ctx.deOutraEmpresa}`, usuario);
    const historico = await get(`/historico/${ctx.deOutraEmpresa}?mes=${MES}`, usuario);
    assert.equal(hoje.status, 200);
    assert.deepEqual(hoje.corpo, []);
    assert.equal(historico.status, 200);
    assert.deepEqual(historico.corpo, []);
});

test('Colaborador continua restrito ao próprio vínculo', { skip: semBanco }, async () => {
    const usuario = ctx.tokenColaborador;

    const proprio = await get(`/hoje/${ctx.alvo}`, usuario);
    assert.equal(proprio.status, 200);
    assert.deepEqual(tipos(proprio.corpo), ['Entrada', 'Saída']);

    for (const caminho of [`/hoje/${ctx.outro}`, `/historico/${ctx.outro}?mes=${MES}`, `/totais/${ctx.outro}`]) {
        assert.equal((await get(caminho, usuario)).status, 403, caminho);
    }
});
