// INSS e encargos da folha: regra pura em centavos (sem banco) e a API de folha/holerite contra MySQL real.
// Banco e variáveis em tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST só a parte HTTP é pulada.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import { criarEmpresa, criarFuncionario, criarColaborador } from './support/empresas.ts';
import db from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import type { FolhaDaCompetencia, HoleritePublicado } from '../modules/folha/folha.service.ts';
import * as regras from '../modules/folha/folha.regras.ts';
import { TABELAS_INSS, type TabelaInss } from '../modules/folha/folha.tabelas.ts';

const DIA = '2026-10-02';
const inss = (salario: number, dia = DIA, tabelas: readonly TabelaInss[] = TABELAS_INSS) => regras.calcularHolerite({ salario, dia, tabelasInss: tabelas }).inss;
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
        const { bases, rubricas, ...valores } = regras.calcularHolerite({ salario, dia: DIA });
        for (const [campo, valor] of [...Object.entries(valores), ...Object.entries(bases), ...rubricas.map((r) => [r.codigo, r.valor] as const)]) {
            assert.ok(duasCasas(valor), `${campo} de ${salario} saiu como ${valor}`);
        }
    }
    // Sem regime informado vale a regra geral: 27,8% patronais (770,06) mais 8% de FGTS (221,60).
    const h = regras.calcularHolerite({ salario: 2770, dia: DIA });
    assert.equal(h.employerCharges, 991.66);
    assert.equal(h.netSalary, regras.emReais(277000 - regras.emCentavos(h.inss) - regras.emCentavos(h.irrf)));
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

test('PJ e estágio não pagam INSS nem geram encargo CLT; os demais contratos seguem a regra geral', () => {
    for (const contrato of ['PJ', 'Estágio']) {
        const { baseSalary, inss, irrf, fgts, netSalary, employerCharges } = regras.calcularHolerite({ salario: 3000, dia: DIA, tipoContrato: contrato });
        assert.deepEqual({ baseSalary, inss, irrf, fgts, netSalary, employerCharges }, { baseSalary: 3000, inss: 0, irrf: 0, fgts: 0, netSalary: 3000, employerCharges: 0 }, contrato);
        assert.equal(regras.temVinculoClt(contrato), false);
    }
    for (const contrato of ['CLT', 'Temporário', null]) {
        // 2.900,00: o IRRF é zero (a redução cobre o imposto da tabela), e os encargos são 27,8% + FGTS 8%.
        const { baseSalary, inss, irrf, fgts, netSalary, employerCharges } = regras.calcularHolerite({ salario: 2900, dia: DIA, tipoContrato: contrato });
        assert.deepEqual({ baseSalary, inss, irrf, fgts, netSalary, employerCharges }, { baseSalary: 2900, inss: 236.69, irrf: 0, fgts: 232, netSalary: 2663.31, employerCharges: 1038.2 }, String(contrato));
        assert.equal(regras.temVinculoClt(contrato), true);
    }
});

test('as rubricas trazem o salário, o INSS e, fora do holerite do colaborador, os encargos da empresa', () => {
    assert.deepEqual(regras.calcularHolerite({ salario: 2900, dia: DIA, regime: 'Simples Nacional' }).rubricas, [
        { codigo: 'SALARIO', descricao: 'Salário Base', tipo: 'provento', valor: 2900, referencia: '30 dias' },
        { codigo: 'INSS', descricao: 'Desconto INSS', tipo: 'desconto', valor: 236.69 },
        { codigo: 'FGTS', descricao: 'FGTS', tipo: 'encargo', valor: 232, referencia: '8%' },
    ]);
    assert.deepEqual(regras.calcularHolerite({ salario: 3000, dia: DIA, tipoContrato: 'PJ' }).rubricas, [
        { codigo: 'SALARIO', descricao: 'Salário Base', tipo: 'provento', valor: 3000, referencia: '30 dias' },
    ]);
});

test('só há folha onde há tabela de INSS vigente', () => {
    assert.equal(regras.haTabelaVigente('2026-01-01'), true);
    assert.equal(regras.haTabelaVigente('2025-12-31'), false);
});

const semBanco = banco.skip;
let servidor: Server | undefined;
let baseUrl: string;

test.before(async () => {
    if (semBanco) return;
    await banco.preparar();
    const app = criarApp();
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

test('a folha processada e o holerite do colaborador trazem o INSS em centavos exatos', { skip: semBanco }, async () => {
    const { empresaId } = await criarEmpresa(db);
    const colaboradores: Awaited<ReturnType<typeof criarColaborador>>[] = [];
    for (const [i, [salario]] of SALARIOS.entries()) {
        colaboradores.push(await criarColaborador(db, empresaId, { nome: `Pessoa ${i}`, salario }));
    }
    const chamar = async (metodo: string, usuario: { token: string }, caminho: string) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, { method: metodo, headers: cabecalhosDaSessao(usuario.token) });
        return { status: resposta.status, corpo: await resposta.json() };
    };

    const admin = await criarUsuario(db, { empresaId, perfil: 'Administrador' });
    const processada = await chamar('POST', admin, '/competencias/2026-10/processar');
    assert.equal(processada.status, 201);
    const folha = processada.corpo as FolhaDaCompetencia;
    assert.equal(folha.itens.length, SALARIOS.length);
    for (const [i, [salario, esperado]] of SALARIOS.entries()) {
        const linha = folha.itens.find((item) => item.id === String(colaboradores[i].funcionarioId));
        assert.ok(linha, `holerite de ${colaboradores[i].funcionarioId} ausente da folha`);
        assert.equal(linha.baseSalary, salario);
        assert.equal(linha.inss, esperado);
        assert.equal(linha.deductionsList[0].value, esperado);
        assert.equal(linha.totalDeductions, regras.emReais(regras.emCentavos(esperado) + regras.emCentavos(linha.irrf)));
        assert.equal(linha.netSalary, regras.emReais(regras.emCentavos(salario) - regras.emCentavos(linha.totalDeductions)));
        for (const campo of ['baseSalary', 'totalGross', 'totalDeductions', 'netSalary', 'employerCharges'] as const) {
            assert.ok(duasCasas(linha[campo]), `${campo} de ${salario} saiu como ${linha[campo]}`);
        }
    }
    for (const total of Object.values(folha.totais)) assert.ok(duasCasas(total), `total ${total}`);

    assert.equal((await chamar('POST', admin, '/competencias/2026-10/fechar')).status, 200);
    for (const [i, [, esperado]] of SALARIOS.entries()) {
        const res = await chamar('GET', colaboradores[i], '/meu-holerite?competencia=2026-10');
        assert.equal(res.status, 200);
        assert.equal((res.corpo as HoleritePublicado).inss, esperado);
        assert.ok(duasCasas((res.corpo as HoleritePublicado).employerCharges));
    }
});
