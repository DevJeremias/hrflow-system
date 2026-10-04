// Requer MySQL real: o banco é criado e migrado por tests/support/bancoDeTeste.ts
// (variáveis HRFLOW_TEST_DB_*). Sem HRFLOW_TEST_DB_HOST os testes são marcados como
// ignorados, nunca como aprovados.
import test from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import assert from 'node:assert/strict';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';

import db from '../shared/db/pool.ts';
import { carregarFixtures } from '../shared/db/fixtures.ts';
import { criarApp } from '../app.ts';
import { relogio, criarFuso } from '../shared/utils/fuso.ts';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

const semBanco = banco.skip;
const ctx: Record<string, any> = {};
let servidor: Server;
let baseUrl: string;

// "Hoje" é o dia de Belém no instante fixado aqui, para o teste não atravessar a virada do dia.
const AGORA = Math.floor(Date.now() / 1000);
const belem = criarFuso('America/Belem');
const { inicio: INICIO_DE_HOJE } = belem.limitesDoDia(belem.diaLocal(AGORA));

const empresaPorNome = async (nome: string) => (await db.query<RowDataPacket[]>('SELECT id FROM empresas WHERE nome = ?', [nome]))[0][0].id;

const novoFuncionario = async (empresaId: number, indice: number, status: string) => {
    const [r] = await db.query<ResultSetHeader>(
        `INSERT INTO funcionarios (nome, cpf, email, data_admissao, status, empresa_id) VALUES (?, ?, ?, '2024-01-02', ?, ?)`,
        [`Extra Ficticio ${indice}`, `111.111.111-0${indice}`, `extra${indice}@exemplo.invalid`, status, empresaId]
    );
    return r.insertId;
};

const novoPonto = (funcionarioId: number, empresaId: number, tipo: string, instante: number) =>
    db.query(
        'INSERT INTO registro_pontos (funcionario_id, empresa_id, tipo_registro, data_hora_oficial) VALUES (?, ?, ?, FROM_UNIXTIME(?))',
        [funcionarioId, empresaId, tipo, instante]
    );

const resumo = async (token: string | null | undefined) => {
    const resposta = await fetch(`${baseUrl}/resumo`, { headers: { ...cabecalhosDaSessao(token) } });
    return { status: resposta.status, corpo: await resposta.json() };
};

test.before(async () => {
    if (semBanco) return;
    relogio.agora = () => AGORA * 1000;
    await banco.preparar();
    await carregarFixtures(db, { senha: 'senha-ficticia' });
    // As fixtures marcam "ontem" no fuso do MySQL, que perto da virada pode cair em "hoje" de Belém.
    await db.query('DELETE FROM registro_pontos');

    ctx.alfa = await empresaPorNome('Empresa Ficticia Alfa Ltda');
    ctx.beta = await empresaPorNome('Empresa Ficticia Beta Ltda');
    ctx.tokenAlfa = (await criarUsuario(db, { empresaId: ctx.alfa, perfil: 'Administrador' })).token;
    ctx.tokenRhAlfa = (await criarUsuario(db, { empresaId: ctx.alfa, perfil: 'RH' })).token;
    ctx.tokenBeta = (await criarUsuario(db, { empresaId: ctx.beta, perfil: 'Administrador' })).token;
    ctx.tokenColaborador = (await criarUsuario(db, { empresaId: ctx.alfa, perfil: 'Colaborador' })).token;

    const app = criarApp();
    await new Promise((resolve) => { servidor = app.listen(0, '127.0.0.1', resolve); });
    baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api/dashboard`;
});

test.after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve));
    await db.end();
    if (!semBanco) await banco.encerrar();
});

test('a Alfa das fixtures mostra 3 colaboradores ativos, 4 departamentos e 4 cargos', { skip: semBanco }, async () => {
    const { status, corpo } = await resumo(ctx.tokenAlfa);
    assert.equal(status, 200);
    assert.deepEqual(corpo, { colaboradoresAtivos: 3, colaboradoresInativos: 0, departamentos: 4, cargos: 4, marcacoesHoje: 0 });
});

test('o RH vê o mesmo resumo do Administrador', { skip: semBanco }, async () => {
    const admin = await resumo(ctx.tokenAlfa);
    const rh = await resumo(ctx.tokenRhAlfa);
    assert.equal(rh.status, 200);
    assert.deepEqual(rh.corpo, admin.corpo);
});

test('o resumo conta só a empresa de quem pede, com duas empresas com dados', { skip: semBanco }, async () => {
    const ativoAlfa = await novoFuncionario(ctx.alfa, 1, 'Ativo');
    await novoFuncionario(ctx.alfa, 2, 'Férias');
    await novoFuncionario(ctx.alfa, 3, 'Inativo');
    const ativoBeta = await novoFuncionario(ctx.beta, 4, 'Ativo');
    await db.query(`INSERT INTO departamentos (nome, sigla, empresa_id) VALUES ('Extra Ficticio', 'EXT', ?)`, [ctx.beta]);
    await novoPonto(ativoAlfa, ctx.alfa, 'Entrada', INICIO_DE_HOJE + 8 * 3600);
    await novoPonto(ativoAlfa, ctx.alfa, 'Saída', INICIO_DE_HOJE + 17 * 3600);
    await novoPonto(ativoBeta, ctx.beta, 'Entrada', INICIO_DE_HOJE + 9 * 3600);
    await novoPonto(ativoBeta, ctx.beta, 'Pausa Almoço', INICIO_DE_HOJE + 12 * 3600);
    await novoPonto(ativoBeta, ctx.beta, 'Retorno Almoço', INICIO_DE_HOJE + 13 * 3600);

    const alfa = await resumo(ctx.tokenAlfa);
    assert.deepEqual(alfa.corpo, { colaboradoresAtivos: 5, colaboradoresInativos: 1, departamentos: 4, cargos: 4, marcacoesHoje: 2 });

    const beta = await resumo(ctx.tokenBeta);
    assert.deepEqual(beta.corpo, { colaboradoresAtivos: 2, colaboradoresInativos: 0, departamentos: 5, cargos: 4, marcacoesHoje: 3 });
});

test('marcações de ontem e de amanhã em Belém não entram em "hoje"', { skip: semBanco }, async () => {
    const [[{ id }]] = await db.query<RowDataPacket[]>(`SELECT id FROM funcionarios WHERE email = 'extra1@exemplo.invalid'`);
    await novoPonto(id, ctx.alfa, 'Entrada', INICIO_DE_HOJE - 1);
    await novoPonto(id, ctx.alfa, 'Entrada', INICIO_DE_HOJE + 24 * 3600);
    const { corpo } = await resumo(ctx.tokenAlfa);
    assert.equal(corpo.marcacoesHoje, 2);
});

test('Colaborador recebe 403 e quem não tem sessão recebe 401', { skip: semBanco }, async () => {
    assert.equal((await resumo(ctx.tokenColaborador)).status, 403);
    assert.equal((await resumo(null)).status, 401);
});
