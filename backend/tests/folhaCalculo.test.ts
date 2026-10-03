// INSS da folha: regra pura em centavos (sem banco) e a API de folha/holerite contra MySQL real.
// Banco e variáveis em tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST só a parte HTTP é pulada.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import db from '../shared/db/pool.ts';
import authMiddleware from '../shared/middlewares/authMiddleware.ts';
import { folhaRoutes } from '../modules/folha/index.ts';
import type { HoleriteDoColaborador } from '../modules/folha/folha.service.ts';
import * as regras from '../modules/folha/folha.regras.ts';
import { TABELAS_INSS, type TabelaInss } from '../modules/folha/folha.tabelas.ts';

const DIA = '2026-10-02';
const inss = (salario: number, dia = DIA, tabelas: readonly TabelaInss[] = TABELAS_INSS) => regras.calcularHolerite(salario, dia, tabelas).inss;
const duasCasas = (valor: number) => Math.abs(Math.round(valor * 100) - valor * 100) < 1e-9;

test('INSS 2026 bate com a tabela progressiva nos valores de referência', () => {
    assert.equal(inss(1621.00), 121.58);
    assert.equal(inss(2900.00), 236.69);
    assert.equal(inss(4354.27), 411.11);
    assert.equal(inss(5200.00), 529.51);
    assert.equal(inss(6800.00), 753.51);
    assert.equal(inss(10000.00), 988.09);
});

test('cada faixa incide só sobre a parcela que cai nela, e o teto trava a contribuição', () => {
    // 100,00 a mais de salário custa a alíquota da faixa em que a parcela cai
    assert.equal(inss(1600) - inss(1500), 7.5);
    assert.equal(inss(2902.84) - inss(2802.84), 9);
    assert.equal(inss(3002.84) - inss(2902.84), 12);
    assert.equal(inss(4454.27) - inss(4354.27), 14);
    assert.equal(inss(8475.55), 988.09);
    assert.equal(inss(8575.55), 988.09);
    assert.equal(inss(1000000), 988.09);
});

test('as bordas das faixas pertencem à faixa de baixo', () => {
    assert.equal(inss(1621.00), 121.58);
    assert.equal(inss(1621.01), 121.58);
    assert.equal(inss(2902.84), 236.94);
    assert.equal(inss(2902.85), 236.94);
    assert.equal(inss(4354.27), 411.11);
    assert.equal(inss(4354.28), 411.11);
    assert.equal(inss(8475.54), 988.09);
});

test('o arredondamento é meio para cima sobre a soma das faixas', () => {
    assert.equal(inss(1621.00), 121.58); // 121,575
    assert.equal(inss(1500.00), 112.50);
    assert.equal(inss(1500.01), 112.50); // 112,50075
    assert.equal(inss(1500.07), 112.51); // 112,50525
});

test('salário zero, negativo ou inválido não gera desconto', () => {
    assert.equal(inss(0), 0);
    assert.equal(inss(-100), 0);
    assert.equal(inss(Number.NaN), 0);
});

test('todo valor do holerite tem no máximo duas casas', () => {
    for (const salario of [1412, 1621.01, 2321.33, 3333.33, 5200.07, 7777.77, 12000.99]) {
        for (const [campo, valor] of Object.entries(regras.calcularHolerite(salario, DIA))) {
            assert.ok(duasCasas(valor), `${campo} de ${salario} saiu como ${valor}`);
        }
    }
    const h = regras.calcularHolerite(2770, DIA);
    assert.equal(h.employerCharges, 770.06);
    assert.equal(h.netSalary, regras.emReais(277000 - regras.emCentavos(h.inss)));
});

test('tabela nova entra pela vigência, sem mexer no cálculo', () => {
    const futura = { vigencia_inicio: '2027-01-01', faixas: [{ ate: 200000, aliquota: 100 }, { ate: 500000, aliquota: 200 }] };
    const tabelas = [...TABELAS_INSS, futura];
    assert.equal(regras.tabelaVigente('2026-12-31', tabelas), TABELAS_INSS[0]);
    assert.equal(regras.tabelaVigente('2027-01-01', tabelas), futura);
    assert.equal(inss(1000, '2026-12-31', tabelas), 75);
    assert.equal(inss(1000, '2027-01-01', tabelas), 100);
    assert.equal(inss(9000, '2027-06-01', tabelas), 800);
});

test('data anterior à primeira vigência é recusada em vez de usar tabela errada', () => {
    assert.throws(() => regras.tabelaVigente('2025-12-31'), /Nenhuma tabela de INSS vigente/);
});

test('a tabela publicada tem vigência e faixas crescentes', () => {
    for (const tabela of TABELAS_INSS) {
        assert.match(tabela.vigencia_inicio, /^\d{4}-\d{2}-\d{2}$/);
        const tetos = tabela.faixas.map((faixa) => faixa.ate);
        assert.deepEqual(tetos, [...tetos].sort((a, b) => a - b));
    }
});

const semBanco = banco.skip;
let servidor: Server | undefined;
let baseUrl: string;

test.before(async () => {
    if (semBanco) return;
    await banco.preparar();
    const app = express();
    app.use(express.json());
    app.use('/api/folha', authMiddleware, folhaRoutes);
    await new Promise<void>((resolve) => { servidor = app.listen(0, '127.0.0.1', () => resolve()); });
    baseUrl = `http://127.0.0.1:${(servidor!.address() as AddressInfo).port}/api/folha`;
});

test.after(async () => {
    const aberto = servidor;
    if (aberto) await new Promise((resolve) => aberto.close(resolve));
    await db.end();
    if (!semBanco) await banco.encerrar();
});

const SALARIOS: [number, number][] = [
    [1621.00, 121.58], [2900.00, 236.69], [4354.27, 411.11], [6800.00, 753.51], [10000.00, 988.09],
];

test('GET /processar e /meu-holerite devolvem INSS em centavos exatos', { skip: semBanco }, async () => {
    const [{ insertId: empresa }] = await db.query<ResultSetHeader>('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia']);
    const [[{ cargo }]] = await db.query<RowDataPacket[]>('SELECT MIN(id) AS cargo FROM cargos WHERE empresa_id = ?', [empresa]);
    const [[{ departamento }]] = await db.query<RowDataPacket[]>('SELECT MIN(id) AS departamento FROM departamentos WHERE empresa_id = ?', [empresa]);
    const ids: number[] = [];
    for (const [i, [salario]] of SALARIOS.entries()) {
        const [r] = await db.query<ResultSetHeader>(
            'INSERT INTO funcionarios (nome, email, salario_base, status, cargo_id, departamento_id, empresa_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [`Pessoa ${i}`, `folha${i}@exemplo.invalid`, salario, 'Ativo', cargo, departamento, empresa]
        );
        ids.push(r.insertId);
    }
    const chamar = async (usuario: { token: string }, caminho: string) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, { headers: cabecalhosDaSessao(usuario.token) });
        return { status: resposta.status, corpo: await resposta.json() as HoleriteDoColaborador[] };
    };

    const admin = await criarUsuario(db, { empresaId: empresa, perfil: 'Administrador' });
    const { status, corpo: folha } = await chamar(admin, '/processar');
    assert.equal(status, 200);
    assert.equal(folha.length, SALARIOS.length);
    for (const [i, [salario, esperado]] of SALARIOS.entries()) {
        const linha = folha.find((item) => item.id === String(ids[i]));
        assert.ok(linha, `holerite de ${ids[i]} ausente da folha`);
        assert.equal(linha.baseSalary, salario);
        assert.equal(linha.totalDeductions, esperado);
        assert.equal(linha.deductionsList[0].value, esperado);
        assert.equal(linha.netSalary, regras.emReais(regras.emCentavos(salario) - regras.emCentavos(esperado)));
        for (const campo of ['baseSalary', 'totalGross', 'totalDeductions', 'netSalary', 'employerCharges'] as const) {
            assert.ok(duasCasas(linha[campo]), `${campo} de ${salario} saiu como ${linha[campo]}`);
        }
    }

    for (const [i, [, esperado]] of SALARIOS.entries()) {
        const colaborador = await criarUsuario(db, { empresaId: empresa, perfil: 'Colaborador', funcionarioId: ids[i] });
        const res = await chamar(colaborador, '/meu-holerite');
        assert.equal(res.status, 200);
        assert.equal(res.corpo[0].totalDeductions, esperado);
        assert.ok(duasCasas(res.corpo[0].employerCharges));
    }
});
