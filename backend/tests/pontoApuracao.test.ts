// Apuração do ponto e destino das justificativas, de ponta a ponta contra um MySQL real:
// histórico com todos os dias do mês, totais reais, justificativa de dia sem marcação,
// aprovação e recusa pelo RH. Banco em tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST o
// teste é pulado.
import test from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import assert from 'node:assert/strict';
import express from 'express';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';

import db from '../shared/db/pool.ts';
import authMiddleware from '../shared/middlewares/authMiddleware.ts';
import { pontoRoutes, relogio } from '../modules/ponto/index.ts';
import type { ResultSetHeader } from 'mysql2/promise';

const semBanco = banco.skip;
const MES = '2026-10';
const STATUS_VALIDOS = ['ok', 'atraso', 'incompleto', 'falta', 'justificado', 'fim_de_semana'];
// Terça, 20 de outubro de 2026, meio-dia em Belém: do dia 1 ao 19 está encerrado.
const AGORA = Date.parse('2026-10-20T12:00:00-03:00');

const ctx: Record<string, any> = {};
let servidor: Server;
let baseUrl: string;

const instante = (dia: string, hora: string) => Date.parse(`${dia}T${hora}-03:00`) / 1000;

const marcar = async (funcionarioId: number, empresaId: number, dia: string, marcas: Array<[string, string]>) => {
    for (const [tipo, hora] of marcas) {
        await db.query(
            'INSERT INTO registro_pontos (funcionario_id, empresa_id, tipo_registro, data_hora_oficial) VALUES (?, ?, ?, FROM_UNIXTIME(?))',
            [funcionarioId, empresaId, tipo, instante(dia, hora)]
        );
    }
};

const novaEmpresa = async (nome: string) => (await db.query<ResultSetHeader>('INSERT INTO empresas (nome) VALUES (?)', [nome]))[0].insertId;
const novoFuncionario = async (empresaId: number, nome: string, indice: number, admissao = '2024-01-02') => (await db.query<ResultSetHeader>(
    'INSERT INTO funcionarios (nome, cpf, email, data_admissao, empresa_id) VALUES (?, ?, ?, ?, ?)',
    [nome, `111.000.000-0${indice}`, `apuracao${indice}@exemplo.invalid`, admissao, empresaId]
))[0].insertId;

const chamar = async (metodo: string, caminho: string, token: string | null | undefined, corpo?: unknown) => {
    const resposta = await fetch(`${baseUrl}${caminho}`, {
        method: metodo,
        headers: { ...cabecalhosDaSessao(token), 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { status: resposta.status, corpo: await resposta.json() };
};
const historico = async (funcionarioId: number, token: string, mes = MES) => (await chamar('GET', `/historico/${funcionarioId}?mes=${mes}`, token)).corpo;
const diaDo = (dias: any[], data: string) => dias.find((d) => d.date === data);

test.before(async () => {
    if (semBanco) return;
    await banco.preparar();
    relogio.agora = () => AGORA;

    const sufixo = `${process.pid}-${Date.now()}`;
    ctx.empresaA = await novaEmpresa(`Empresa Ficticia A ${sufixo}`);
    ctx.empresaB = await novaEmpresa(`Empresa Ficticia B ${sufixo}`);
    ctx.rh = await novoFuncionario(ctx.empresaA, 'Rita RH Ficticia', 1);
    ctx.ana = await novoFuncionario(ctx.empresaA, 'Ana Apuracao Ficticia', 2);
    ctx.bia = await novoFuncionario(ctx.empresaA, 'Bia Apuracao Ficticia', 3);
    // Admitida no meio do mês: os dias anteriores não podem virar falta.
    ctx.nova = await novoFuncionario(ctx.empresaA, 'Nina Nova Ficticia', 4, '2026-10-15');
    ctx.externa = await novoFuncionario(ctx.empresaB, 'Eva Externa Ficticia', 5);

    // Ana, quinta 01 e sexta 02: dois dias fechados de 8 horas (08:00 às 12:00 e 13:00 às 17:00).
    for (const dia of ['2026-10-01', '2026-10-02']) {
        await marcar(ctx.ana, ctx.empresaA, dia, [['Entrada', '08:00:00'], ['Pausa Almoço', '12:00:00'], ['Retorno Almoço', '13:00:00'], ['Saída', '17:00:00']]);
    }
    // Segunda 05: chegou às 08:30 (atraso) e saiu às 17:30. Terça 06: sem saída (incompleto).
    await marcar(ctx.ana, ctx.empresaA, '2026-10-05', [['Entrada', '08:30:00'], ['Pausa Almoço', '12:00:00'], ['Retorno Almoço', '13:00:00'], ['Saída', '17:30:00']]);
    await marcar(ctx.ana, ctx.empresaA, '2026-10-06', [['Entrada', '08:00:00']]);
    // Sábado 03: trabalhou quatro horas.
    await marcar(ctx.ana, ctx.empresaA, '2026-10-03', [['Entrada', '09:00:00'], ['Saída', '13:00:00']]);

    const token = async (empresaId: number, perfil: string, funcionarioId: number | null) =>
        (await criarUsuario(db, { empresaId, perfil, funcionarioId })).token;
    ctx.tokenAna = await token(ctx.empresaA, 'Colaborador', ctx.ana);
    ctx.tokenBia = await token(ctx.empresaA, 'Colaborador', ctx.bia);
    ctx.tokenNova = await token(ctx.empresaA, 'Colaborador', ctx.nova);
    ctx.tokenRH = await token(ctx.empresaA, 'RH', ctx.rh);
    ctx.tokenAdmin = await token(ctx.empresaA, 'Administrador', null);
    ctx.tokenRHOutraEmpresa = await token(ctx.empresaB, 'RH', null);

    const app = express();
    app.use(express.json());
    app.use('/api/ponto', authMiddleware, pontoRoutes);
    await new Promise((resolve) => { servidor = app.listen(0, '127.0.0.1', resolve); });
    baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api/ponto`;
});

test.after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve));
    relogio.agora = () => Date.now();
    await db.end();
    if (!semBanco) await banco.encerrar();
});

test('o histórico de outubro traz os 31 dias, em ordem, com um status válido em cada um', { skip: semBanco }, async () => {
    const dias = await historico(ctx.ana, ctx.tokenAna);
    assert.equal(dias.length, 31);
    assert.deepEqual(dias.map((d: any) => d.date), Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`));
    for (const dia of dias) assert.ok(STATUS_VALIDOS.includes(dia.status), `${dia.date}: ${dia.status}`);
});

test('cada dia mostra horas, atraso, ajuste e o status que a apuração dá', { skip: semBanco }, async () => {
    const dias = await historico(ctx.ana, ctx.tokenAna);
    const completo = diaDo(dias, '2026-10-01');
    assert.deepEqual(
        [completo.status, completo.entry, completo.lunchOut, completo.lunchIn, completo.exit, completo.totalHours, completo.delay, completo.open],
        ['ok', '08:00', '12:00', '13:00', '17:00', '08:00', '00:00', false]
    );
    const atrasado = diaDo(dias, '2026-10-05');
    assert.deepEqual([atrasado.status, atrasado.delay, atrasado.totalHours, atrasado.positiveAdjust], ['atraso', '00:30', '08:00', '00:00']);
    assert.equal(diaDo(dias, '2026-10-06').status, 'incompleto');
    assert.equal(diaDo(dias, '2026-10-06').totalHours, '--:--');
    assert.equal(diaDo(dias, '2026-10-07').status, 'falta');
    assert.equal(diaDo(dias, '2026-10-07').negativeAdjust, '08:00');
    const sabado = diaDo(dias, '2026-10-03');
    assert.deepEqual([sabado.status, sabado.totalHours, sabado.positiveAdjust], ['fim_de_semana', '04:00', '04:00']);
    assert.equal(diaDo(dias, '2026-10-04').status, 'fim_de_semana');
});

test('hoje e os dias futuros ficam em aberto, sem falta', { skip: semBanco }, async () => {
    const dias = await historico(ctx.ana, ctx.tokenAna);
    const hoje = diaDo(dias, '2026-10-20');
    assert.deepEqual([hoje.status, hoje.open, hoje.negativeAdjust], ['ok', true, '00:00']);
    assert.deepEqual([diaDo(dias, '2026-10-21').status, diaDo(dias, '2026-10-21').open], ['ok', true]);
});

test('dias antes da admissão não viram falta', { skip: semBanco }, async () => {
    const dias = await historico(ctx.nova, ctx.tokenNova);
    assert.equal(diaDo(dias, '2026-10-14').status, 'ok');
    assert.equal(diaDo(dias, '2026-10-14').open, true);
    assert.equal(diaDo(dias, '2026-10-15').status, 'falta');
});

test('mês sem nenhuma marcação também traz todos os dias', { skip: semBanco }, async () => {
    const dias = await historico(ctx.ana, ctx.tokenAna, '2026-02');
    assert.equal(dias.length, 28);
    assert.equal(diaDo(dias, '2026-02-09').status, 'falta');
});

test('os totais do mês são as horas reais de dois dias fechados mais os demais dias apurados', { skip: semBanco }, async () => {
    const { status, corpo } = await chamar('GET', `/totais/${ctx.bia}?mes=${MES}`, ctx.tokenBia);
    assert.equal(status, 200);
    // Bia não bateu nada: 13 dias úteis encerrados (01 a 19, sem fins de semana) são falta.
    assert.equal(corpo.monthlySummary.workloadDone, '00:00');
    assert.equal(corpo.monthlySummary.absences, 13);
    assert.equal(corpo.monthlySummary.pendingTime, '104:00');
    assert.equal(corpo.monthlySummary.workloadLimit, '176:00');

    const ana = (await chamar('GET', `/totais/${ctx.ana}?mes=${MES}`, ctx.tokenAna)).corpo;
    // 01, 02 e 05: três dias de 8 horas, mais 4 horas de sábado: 28 horas; o dia 06 não fecha.
    assert.equal(ana.monthlySummary.workloadDone, '28:00');
    assert.equal(ana.monthlySummary.excessTime, '04:00');
    assert.equal(ana.monthlySummary.delayTime, '00:30');
    assert.equal(ana.monthlySummary.incompleteDays, 1);
    assert.equal(ana.monthlySummary.absences, 9);
    assert.deepEqual(ana.workSchedule, { weeklyHours: 40, entry: '08:00', exit: '17:00', toleranceMinutes: 10 });
    assert.equal(ana.totals[0].weekLabel, '01/10 a 04/10');
    assert.equal(ana.totals[0].workloadDone, '20:00');
    assert.equal(ana.totals[1].workloadDone, '08:00');
});

test('os totais exigem o mês e o colaborador da empresa', { skip: semBanco }, async () => {
    assert.equal((await chamar('GET', `/totais/${ctx.ana}`, ctx.tokenAna)).status, 400);
    assert.equal((await chamar('GET', `/totais/${ctx.ana}?mes=`, ctx.tokenAna)).status, 400);
    assert.equal((await chamar('GET', `/totais/${ctx.ana}?mes=${MES}`, ctx.tokenRHOutraEmpresa)).status, 404);
    assert.equal((await chamar('GET', `/historico/${ctx.ana}?mes=${MES}`, ctx.tokenRHOutraEmpresa)).status, 404);
});

test('justificar um dia sem marcação é aceito, aparece pendente para o RH e o dia segue como falta', { skip: semBanco }, async () => {
    const enviada = await chamar('PUT', '/justificativa/2026-10-07', ctx.tokenAna, { texto: 'Consulta médica, atestado em anexo.' });
    assert.equal(enviada.status, 200);
    assert.equal(enviada.corpo.status, 'pendente');

    const lista = await chamar('GET', `/justificativas?mes=${MES}&status=pendente`, ctx.tokenRH);
    assert.equal(lista.status, 200);
    assert.equal(lista.corpo.length, 1);
    assert.deepEqual(
        [lista.corpo[0].date, lista.corpo[0].status, lista.corpo[0].nome_funcionario, lista.corpo[0].note],
        ['2026-10-07', 'pendente', 'Ana Apuracao Ficticia', 'Consulta médica, atestado em anexo.']
    );

    const dia = diaDo(await historico(ctx.ana, ctx.tokenAna), '2026-10-07');
    assert.deepEqual([dia.status, dia.noteStatus, dia.note], ['falta', 'pendente', 'Consulta médica, atestado em anexo.']);
    ctx.justificativa = lista.corpo[0].id;
});

test('aprovar muda o status do dia para justificado e tira a falta dos totais', { skip: semBanco }, async () => {
    const antes = (await chamar('GET', `/totais/${ctx.ana}?mes=${MES}`, ctx.tokenAna)).corpo.monthlySummary;
    const { status, corpo } = await chamar('PATCH', `/justificativas/${ctx.justificativa}`, ctx.tokenRH, { status: 'aprovada' });
    assert.equal(status, 200);
    assert.equal(corpo.status, 'aprovada');
    assert.equal(corpo.decidedBy.startsWith('Usuario Ficticio'), true);
    assert.ok(corpo.decidedAt);

    const dia = diaDo(await historico(ctx.ana, ctx.tokenAna), '2026-10-07');
    assert.deepEqual([dia.status, dia.noteStatus, dia.negativeAdjust], ['justificado', 'aprovada', '00:00']);
    const depois = (await chamar('GET', `/totais/${ctx.ana}?mes=${MES}`, ctx.tokenAna)).corpo.monthlySummary;
    assert.equal(depois.absences, antes.absences - 1);
});

test('uma justificativa aprovada não pode mais ser alterada pelo colaborador', { skip: semBanco }, async () => {
    const reenvio = await chamar('PUT', '/justificativa/2026-10-07', ctx.tokenAna, { texto: 'Outro texto.' });
    assert.equal(reenvio.status, 409);
    const lista = await chamar('GET', `/justificativas?mes=${MES}`, ctx.tokenRH);
    assert.equal(lista.corpo[0].note, 'Consulta médica, atestado em anexo.');
});

test('recusar exige o motivo, o colaborador o vê, e o reenvio volta a ser pendente', { skip: semBanco }, async () => {
    await chamar('PUT', '/justificativa/2026-10-08', ctx.tokenAna, { texto: 'Perdi o ônibus.' });
    const { corpo: lista } = await chamar('GET', `/justificativas?mes=${MES}&status=pendente`, ctx.tokenAdmin);
    const id = lista[0].id;

    const semMotivo = await chamar('PATCH', `/justificativas/${id}`, ctx.tokenRH, { status: 'recusada' });
    assert.equal(semMotivo.status, 400);

    const recusada = await chamar('PATCH', `/justificativas/${id}`, ctx.tokenRH, { status: 'recusada', resposta: 'Sem comprovante.' });
    assert.equal(recusada.status, 200);
    assert.equal(recusada.corpo.reply, 'Sem comprovante.');

    const dia = diaDo(await historico(ctx.ana, ctx.tokenAna), '2026-10-08');
    assert.deepEqual([dia.status, dia.noteStatus, dia.noteReply, dia.negativeAdjust], ['falta', 'recusada', 'Sem comprovante.', '08:00']);

    const reenvio = await chamar('PUT', '/justificativa/2026-10-08', ctx.tokenAna, { texto: 'Segue o comprovante do ônibus.' });
    assert.equal(reenvio.status, 200);
    const novo = diaDo(await historico(ctx.ana, ctx.tokenAna), '2026-10-08');
    assert.deepEqual([novo.noteStatus, novo.noteReply], ['pendente', null]);
});

test('o filtro de status separa as justificativas do mês', { skip: semBanco }, async () => {
    const porStatus = async (status: string) => (await chamar('GET', `/justificativas?mes=${MES}&status=${status}`, ctx.tokenRH)).corpo.map((j: any) => j.date);
    assert.deepEqual(await porStatus('aprovada'), ['2026-10-07']);
    assert.deepEqual(await porStatus('pendente'), ['2026-10-08']);
    assert.deepEqual(await porStatus('recusada'), []);
    assert.equal((await chamar('GET', `/justificativas?mes=${MES}`, ctx.tokenRH)).corpo.length, 2);
    assert.equal((await chamar('GET', `/justificativas?mes=${MES}&status=outra`, ctx.tokenRH)).status, 400);
});

test('só RH e Administrador decidem, e só na própria empresa', { skip: semBanco }, async () => {
    const [{ id }] = (await chamar('GET', `/justificativas?mes=${MES}&status=pendente`, ctx.tokenRH)).corpo;
    const decisao = { status: 'aprovada' };
    assert.equal((await chamar('PATCH', `/justificativas/${id}`, ctx.tokenBia, decisao)).status, 403);
    assert.equal((await chamar('PATCH', `/justificativas/${id}`, ctx.tokenAna, decisao)).status, 403);
    assert.equal((await chamar('PATCH', `/justificativas/${id}`, ctx.tokenRHOutraEmpresa, decisao)).status, 404);
    assert.equal((await chamar('PATCH', `/justificativas/${id}`, null, decisao)).status, 401);
    assert.equal((await chamar('PATCH', `/justificativas/999999`, ctx.tokenRH, decisao)).status, 404);
    assert.equal((await chamar('PATCH', `/justificativas/${id}`, ctx.tokenRH, { status: 'pendente' })).status, 400);
    assert.equal((await chamar('PATCH', `/justificativas/abc`, ctx.tokenRH, decisao)).status, 400);
    assert.equal((await chamar('GET', `/justificativas?mes=${MES}&status=pendente`, ctx.tokenRH)).corpo.length, 1);
});

test('o RH não decide a justificativa do próprio ponto, mas o Administrador decide', { skip: semBanco }, async () => {
    assert.equal((await chamar('PUT', '/justificativa/2026-10-09', ctx.tokenRH, { texto: 'Treinamento externo.' })).status, 200);
    const [propria] = (await chamar('GET', `/justificativas?mes=${MES}&funcionarioId=${ctx.rh}`, ctx.tokenAdmin)).corpo;
    assert.equal(propria.nome_funcionario, 'Rita RH Ficticia');

    const proprio = await chamar('PATCH', `/justificativas/${propria.id}`, ctx.tokenRH, { status: 'aprovada' });
    assert.equal(proprio.status, 403);
    assert.equal((await chamar('GET', `/justificativas?mes=${MES}&status=pendente`, ctx.tokenRH)).corpo.length, 2);

    const doAdmin = await chamar('PATCH', `/justificativas/${propria.id}`, ctx.tokenAdmin, { status: 'aprovada' });
    assert.equal(doAdmin.status, 200);
});
