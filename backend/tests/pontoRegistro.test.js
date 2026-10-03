// Registro de ponto contra MySQL real: GPS persistido, sequência das marcações validada no servidor,
// respostas 4xx acionáveis e data/hora no fuso de Belém. O relógio do servidor é fixado por teste.
// Banco e variáveis em tests/support/bancoDeTeste.js; sem HRFLOW_TEST_DB_HOST o teste é pulado.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const banco = require('./support/bancoDeTeste');
const { criarUsuario, cabecalhosDaSessao } = require('./support/sessao');

const db = require('../config/db');
const authMiddleware = require('../middlewares/authMiddleware');
const { pontoRoutes } = require('../modules/ponto/index.ts');
const { relogio } = require('../modules/ponto/ponto.service.ts');

const semBanco = banco.skip;
const ctx = {};
let servidor;
let baseUrl;
let contador = 0;

// 01:30 UTC de 11/03 é 22:30 de 10/03 em Belém: toISOString diria 11/03.
const NOITE_10 = Date.parse('2026-03-11T01:30:00Z');
const hora = (iso) => { relogio.agora = () => Date.parse(iso); };

const novaEmpresa = async (nome) => (await db.query('INSERT INTO empresas (nome) VALUES (?)', [nome]))[0].insertId;

const novoFuncionario = async (empresaId, nome) => {
    contador += 1;
    const [r] = await db.query(
        `INSERT INTO funcionarios (nome, cpf, email, data_admissao, empresa_id) VALUES (?, ?, ?, '2024-01-02', ?)`,
        [nome, `000.000.001-${String(contador).padStart(2, '0')}`, `ponto${contador}@exemplo.invalid`, empresaId]
    );
    return r.insertId;
};

// O authMiddleware confere o usuário no banco: cada ator é um usuário real, com o token que o login emitiria.
const ator = async (perfil, funcionarioId, empresaId = ctx.empresaA) => {
    const { token } = await criarUsuario(db, { empresaId, perfil, funcionarioId });
    return { funcionario_id: funcionarioId, token };
};
const colaborador = (funcionarioId, empresaId = ctx.empresaA) => ator('Colaborador', funcionarioId, empresaId);

const chamar = async (metodo, caminho, usuario, corpo) => {
    const resposta = await fetch(`${baseUrl}${caminho}`, {
        method: metodo,
        headers: { ...cabecalhosDaSessao(usuario.token), 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { status: resposta.status, corpo: await resposta.json() };
};
const registrar = (usuario, corpo) => chamar('POST', '/registrar', usuario, corpo);
const linhas = async (funcionarioId) => (await db.query(
    'SELECT tipo_registro, latitude, longitude, UNIX_TIMESTAMP(data_hora_oficial) AS instante, observacao FROM registro_pontos WHERE funcionario_id = ? ORDER BY id',
    [funcionarioId]
))[0];

// Funcionário novo por teste: a sequência é por colaborador e por dia.
const novoUsuario = async () => colaborador(await novoFuncionario(ctx.empresaA, 'Pessoa Ficticia'));

test.before(async () => {
    if (semBanco) return;
    await banco.preparar();
    ctx.empresaA = await novaEmpresa('Empresa Ficticia A');
    ctx.empresaB = await novaEmpresa('Empresa Ficticia B');

    const app = express();
    app.use(express.json());
    app.use('/api/ponto', authMiddleware, pontoRoutes);
    await new Promise((resolve) => { servidor = app.listen(0, '127.0.0.1', resolve); });
    baseUrl = `http://127.0.0.1:${servidor.address().port}/api/ponto`;
});

test.beforeEach(() => { relogio.agora = () => NOITE_10; });

test.after(async () => {
    relogio.agora = () => Date.now();
    if (servidor) await new Promise((resolve) => servidor.close(resolve));
    await db.end();
    if (!semBanco) await banco.encerrar();
});

test('persiste latitude e longitude da marcação', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    const { status } = await registrar(usuario, { tipo: 'Entrada', latitude: -1.45502, longitude: -48.5024 });
    assert.equal(status, 201);
    const [marcacao] = await linhas(usuario.funcionario_id);
    assert.equal(Number(marcacao.latitude), -1.45502);
    assert.equal(Number(marcacao.longitude), -48.5024);
});

test('coordenada zero é persistida como zero, não como ausente', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    await registrar(usuario, { tipo: 'Entrada', latitude: 0, longitude: 0 });
    const [marcacao] = await linhas(usuario.funcionario_id);
    assert.equal(Number(marcacao.latitude), 0);
    assert.equal(marcacao.latitude === null, false);
});

test('sem coordenadas a marcação é aceita e fica com NULL', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    assert.equal((await registrar(usuario, { tipo: 'Entrada' })).status, 201);
    const [marcacao] = await linhas(usuario.funcionario_id);
    assert.equal(marcacao.latitude, null);
    assert.equal(marcacao.longitude, null);
});

test('o formato antigo do front (localizacao: {lat, lng}) não grava coordenadas em silêncio', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    await registrar(usuario, { tipo: 'Entrada', localizacao: { lat: -1.4, lng: -48.5 } });
    assert.equal((await linhas(usuario.funcionario_id))[0].latitude, null);
});

test('coordenadas inválidas retornam 400 com mensagem e nada é gravado', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    const casos = [
        [{ latitude: 91, longitude: 0 }, /Latitude fora/],
        [{ latitude: 0, longitude: -181 }, /Longitude fora/],
        [{ latitude: -1.4 }, /juntas/],
        [{ longitude: -48.5 }, /juntas/],
        [{ latitude: '-1.4', longitude: '-48.5' }, /devem ser números/],
        [{ latitude: true, longitude: 0 }, /devem ser números/],
    ];
    for (const [coordenadas, mensagem] of casos) {
        const { status, corpo } = await registrar(usuario, { tipo: 'Entrada', ...coordenadas });
        assert.equal(status, 400, JSON.stringify(coordenadas));
        assert.match(corpo.erro, mensagem);
    }
    assert.equal((await linhas(usuario.funcionario_id)).length, 0);
});

test('tipo ausente ou inválido retorna 400 listando os tipos aceitos', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    for (const corpo of [{}, { tipo: 'Extra' }, { tipo: 'entrada' }, { tipo: 7 }]) {
        const resposta = await registrar(usuario, corpo);
        assert.equal(resposta.status, 400, JSON.stringify(corpo));
        assert.match(resposta.corpo.erro, /Entrada, Pausa Almoço, Retorno Almoço, Saída/);
    }
    assert.equal((await linhas(usuario.funcionario_id)).length, 0);
});

test('observação longa demais retorna 400 em vez de 500', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    const { status, corpo } = await registrar(usuario, { tipo: 'Entrada', observacao: 'x'.repeat(256) });
    assert.equal(status, 400);
    assert.match(corpo.erro, /no máximo 255/);
});

test('a sequência completa do dia é aceita', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    for (const tipo of ['Entrada', 'Pausa Almoço', 'Retorno Almoço', 'Saída']) {
        assert.equal((await registrar(usuario, { tipo })).status, 201, tipo);
    }
    const { corpo } = await chamar('GET', `/hoje/${usuario.funcionario_id}`, usuario);
    assert.deepEqual(corpo.map((p) => p.type), ['Entrada', 'Pausa Almoço', 'Retorno Almoço', 'Saída']);
});

test('a pausa de almoço é opcional: Entrada pode ir direto para Saída', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    assert.equal((await registrar(usuario, { tipo: 'Entrada' })).status, 201);
    assert.equal((await registrar(usuario, { tipo: 'Saída' })).status, 201);
});

test('Saída como primeira marcação do dia é 409 e diz o que registrar', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    const { status, corpo } = await registrar(usuario, { tipo: 'Saída' });
    assert.equal(status, 409);
    assert.deepEqual(corpo.proximosPermitidos, ['Entrada']);
    assert.match(corpo.erro, /Ainda não há registros hoje\. Registre "Entrada"/);
    assert.equal((await linhas(usuario.funcionario_id)).length, 0);
});

test('repetir Entrada é 409 e cita o último registro com a hora de Belém', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    await registrar(usuario, { tipo: 'Entrada' });
    const { status, corpo } = await registrar(usuario, { tipo: 'Entrada' });
    assert.equal(status, 409);
    assert.match(corpo.erro, /último registro de hoje foi "Entrada" às 22:30:00/);
    assert.deepEqual(corpo.proximosPermitidos, ['Pausa Almoço', 'Saída']);
    assert.equal((await linhas(usuario.funcionario_id)).length, 1);
});

test('pular a volta do almoço é 409', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    await registrar(usuario, { tipo: 'Entrada' });
    await registrar(usuario, { tipo: 'Pausa Almoço' });
    for (const tipo of ['Saída', 'Pausa Almoço', 'Entrada']) {
        const { status, corpo } = await registrar(usuario, { tipo });
        assert.equal(status, 409, tipo);
        assert.deepEqual(corpo.proximosPermitidos, ['Retorno Almoço']);
    }
});

test('depois da Saída o dia está encerrado: qualquer marcação é 409', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    await registrar(usuario, { tipo: 'Entrada' });
    await registrar(usuario, { tipo: 'Saída' });
    for (const tipo of ['Entrada', 'Pausa Almoço', 'Saída']) {
        const { status, corpo } = await registrar(usuario, { tipo });
        assert.equal(status, 409, tipo);
        assert.match(corpo.erro, /jornada de hoje já foi encerrada/);
        assert.deepEqual(corpo.proximosPermitidos, []);
    }
});

test('marcações simultâneas do mesmo colaborador: só uma passa', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    const respostas = await Promise.all(Array.from({ length: 6 }, () => registrar(usuario, { tipo: 'Entrada' })));
    assert.deepEqual(respostas.map((r) => r.status).sort(), [201, 409, 409, 409, 409, 409]);
    assert.equal((await linhas(usuario.funcionario_id)).length, 1);
});

test('a sequência é por colaborador: o ponto de um não conta para o outro', { skip: semBanco }, async () => {
    const [a, b] = [await novoUsuario(), await novoUsuario()];
    await registrar(a, { tipo: 'Entrada' });
    assert.equal((await registrar(b, { tipo: 'Entrada' })).status, 201);
});

test('o id do corpo é ignorado: a marcação é do colaborador do token', { skip: semBanco }, async () => {
    const [eu, outro] = [await novoUsuario(), await novoUsuario()];
    await registrar(eu, { tipo: 'Entrada', funcionario_id: outro.funcionario_id });
    assert.equal((await linhas(eu.funcionario_id)).length, 1);
    assert.equal((await linhas(outro.funcionario_id)).length, 0);
});

test('o banco recusa ator vinculado a colaborador de outra empresa antes de registrar ponto', { skip: semBanco }, async () => {
    const id = await novoFuncionario(ctx.empresaA, 'Pessoa Ficticia');
    await assert.rejects(colaborador(id, ctx.empresaB), { code: 'ER_NO_REFERENCED_ROW_2' });
    assert.equal((await linhas(id)).length, 0);
});

test('usuário sem vínculo de colaborador continua com 403', { skip: semBanco }, async () => {
    const { status } = await registrar(await ator('Administrador', null), { tipo: 'Entrada' });
    assert.equal(status, 403);
});

test('data e hora da resposta e da leitura são de Belém, perto da meia-noite UTC', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    const { corpo } = await registrar(usuario, { tipo: 'Entrada' });
    assert.equal(corpo.date, '2026-03-10');
    assert.equal(corpo.time, '22:30:00');
    assert.equal((await linhas(usuario.funcionario_id))[0].instante, NOITE_10 / 1000);

    const hoje = await chamar('GET', `/hoje/${usuario.funcionario_id}`, usuario);
    assert.deepEqual(hoje.corpo.map(({ date, time }) => [date, time]), [['2026-03-10', '22:30:00']]);

    const historico = await chamar('GET', `/historico/${usuario.funcionario_id}?mes=2026-03`, usuario);
    assert.deepEqual(historico.corpo.map((d) => [d.date, d.entry]), [['2026-03-10', '22:30']]);
});

test('a virada do dia em Belém (03:00 UTC) abre uma jornada nova e "hoje" não mistura os dias', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    hora('2026-03-11T02:59:59Z');
    await registrar(usuario, { tipo: 'Entrada' });
    await registrar(usuario, { tipo: 'Saída' });
    assert.equal((await registrar(usuario, { tipo: 'Entrada' })).status, 409);

    hora('2026-03-11T03:00:00Z');
    const nova = await registrar(usuario, { tipo: 'Entrada' });
    assert.equal(nova.status, 201);
    assert.deepEqual([nova.corpo.date, nova.corpo.time], ['2026-03-11', '00:00:00']);

    const hoje = await chamar('GET', `/hoje/${usuario.funcionario_id}`, usuario);
    assert.deepEqual(hoje.corpo.map((p) => p.type), ['Entrada']);

    const historico = await chamar('GET', `/historico/${usuario.funcionario_id}?mes=2026-03`, usuario);
    assert.deepEqual(historico.corpo.map((d) => d.date), ['2026-03-10', '2026-03-11']);
    assert.equal(historico.corpo[0].exit, '23:59');
});

test('o histórico do mês respeita as bordas do mês de Belém', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    hora('2026-04-01T02:59:59Z'); // 31/03 23:59:59 em Belém
    await registrar(usuario, { tipo: 'Entrada' });
    hora('2026-04-01T03:00:00Z'); // 01/04 00:00:00 em Belém
    await registrar(usuario, { tipo: 'Entrada' }); // outro dia: a Entrada de 31/03 sem Saída não bloqueia

    const marco = await chamar('GET', `/historico/${usuario.funcionario_id}?mes=2026-03`, usuario);
    const abril = await chamar('GET', `/historico/${usuario.funcionario_id}?mes=2026-04`, usuario);
    assert.deepEqual(marco.corpo.map((d) => [d.date, d.entry, d.exit]), [['2026-03-31', '23:59', '--:--']]);
    assert.deepEqual(abril.corpo.map((d) => [d.date, d.entry, d.exit]), [['2026-04-01', '00:00', '--:--']]);
});

test('mês ausente ou malformado no histórico é 400', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    for (const mes of ['', '?mes=', '?mes=2026-13', '?mes=março', "?mes=2026-03'--"]) {
        const { status, corpo } = await chamar('GET', `/historico/${usuario.funcionario_id}${mes}`, usuario);
        assert.equal(status, 400, mes);
        assert.match(corpo.erro, /AAAA-MM/);
    }
});

test('a listagem de RH mostra coordenadas e o relógio de Belém', { skip: semBanco }, async () => {
    const usuario = await novoUsuario();
    await registrar(usuario, { tipo: 'Entrada', latitude: -1.45502, longitude: -48.5024 });
    const { status, corpo } = await chamar('GET', '/?mes=2026-03', await ator('RH', null));
    assert.equal(status, 200);
    const meu = corpo.find((p) => p.funcionario_id === usuario.funcionario_id);
    assert.equal(Number(meu.latitude), -1.45502);
    assert.equal(Number(meu.longitude), -48.5024);
    assert.equal(meu.data_hora_oficial, '2026-03-11T01:30:00.000Z');
    assert.deepEqual([meu.date, meu.time], ['2026-03-10', '22:30:00']);
    assert.equal(Object.hasOwn(meu, 'instante'), false);
});
