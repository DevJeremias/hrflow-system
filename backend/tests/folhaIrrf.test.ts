// IRRF, FGTS, eventos e encargos da folha: regra pura em centavos, sem banco. Os valores esperados
// vêm da Receita Federal ("Tributação de 2026" e os "exemplos de aplicação da Lei 15.270/2025",
// reproduzidos em docs/folha-irrf-exemplo-auditado.md) e de contas feitas à mão, nunca da própria função.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as regras from '../modules/folha/folha.regras.ts';
import { TABELAS_IRRF, TABELAS_INSS, type TabelaIrrf } from '../modules/folha/folha.tabelas.ts';
import { eventosDoPonto } from '../modules/folha/folha.ponto.ts';
import type { DiaApurado } from '../modules/ponto/index.ts';

const DIA = '2026-10-01';
const TABELA = TABELAS_IRRF[0];
const irrf = (rendimento: number, inss: number, dependentes = 0) =>
    regras.emReais(regras.calcularIrrfEmCentavos(regras.emCentavos(rendimento), regras.emCentavos(inss), dependentes, TABELA).irrf);

test('exemplos da Receita Federal: alíquota zero, redução até 5 mil, redução acima de 5 mil e renda sem redução', () => {
    // Exemplo 1: 3.036,00 com INSS de 257,73. O desconto simplificado (607,20) vale mais: base 2.428,00, faixa isenta.
    assert.equal(irrf(3036, 257.73), 0);
    // Exemplo 2: 4.000,00 com INSS de 373,41. Base 3.392,80, imposto 114,76, anulado pela redução.
    assert.equal(irrf(4000, 373.41), 0);
    // Exemplo 3: 5.000,00 com INSS de 509,60. Base 4.392,80, imposto 312,89, anulado pela redução de 312,89.
    assert.equal(irrf(5000, 509.60), 0);
    // Exemplo 4: 6.000,00 com INSS de 649,60. Base 5.350,40, imposto 562,63, redução 978,62 - 0,133145 x 6.000 = 179,75.
    const exemplo4 = regras.calcularIrrfEmCentavos(600000, 64960, 0, TABELA);
    assert.deepEqual(exemplo4, { baseDeCalculo: 535040, impostoDaTabela: 56263, reducao: 17975, irrf: 38288 });
    // Exemplo 5: 7.607,20 sem dedução legal. Base 7.000,00, imposto 1.016,27, sem redução (rendimento acima de 7.350,00).
    const exemplo5 = regras.calcularIrrfEmCentavos(760720, 0, 0, TABELA);
    assert.deepEqual(exemplo5, { baseDeCalculo: 700000, impostoDaTabela: 101627, reducao: 0, irrf: 101627 });
});

test('para 6.800,00 sem dependentes: INSS 753,51 e IRRF 680,82', () => {
    const h = regras.calcularHolerite({ salario: 6800, dia: DIA });
    assert.equal(h.inss, 753.51);
    // Base 6.800,00 - 753,51 = 6.046,49; imposto 27,5% - 908,73 = 754,05; redução 978,62 - 0,133145 x 6.800 = 73,23.
    assert.equal(h.bases.irrf, 6046.49);
    assert.equal(h.irrf, 680.82);
    assert.equal(h.netSalary, 5365.67);
});

test('dependente reduz a base do IRRF em 189,59 e o imposto em 27,5% disso', () => {
    const sem = regras.calcularHolerite({ salario: 6800, dia: DIA });
    const com = regras.calcularHolerite({ salario: 6800, dia: DIA, dependentes: 1 });
    assert.equal(com.bases.irrf, 5856.9);
    assert.equal(regras.emCentavos(sem.bases.irrf) - regras.emCentavos(com.bases.irrf), 18959);
    // Base 5.856,90; imposto 1.610,65 - 908,73 = 701,92; menos a mesma redução de 73,23.
    assert.equal(com.irrf, 628.69);
    assert.ok(com.irrf < sem.irrf);
    assert.equal(regras.calcularHolerite({ salario: 6800, dia: DIA, dependentes: 3 }).bases.irrf, 5477.72);
    // O INSS não muda com dependentes.
    assert.equal(com.inss, sem.inss);
});

test('o desconto simplificado substitui as deduções legais só quando é maior', () => {
    // 6.000,00 com 2 dependentes: INSS 641,51 + 379,18 = 1.020,69 > 607,20, então valem as deduções legais.
    assert.equal(regras.calcularHolerite({ salario: 6000, dia: DIA, dependentes: 2 }).bases.irrf, 4979.31);
    // 3.000,00 (INSS 248,60) sem dependentes: vale o simplificado, base 2.392,80.
    assert.equal(regras.calcularHolerite({ salario: 3000, dia: DIA }).bases.irrf, 2392.8);
    // Com 4 dependentes as deduções legais passam a valer mais: 248,60 + 758,36 = 1.006,96.
    assert.equal(regras.calcularHolerite({ salario: 3000, dia: DIA, dependentes: 4 }).bases.irrf, 1993.04);
});

// Tabela sem desconto simplificado e sem redução, só para exercitar as faixas pela base de cálculo.
const SO_FAIXAS: TabelaIrrf = { ...TABELA, descontoSimplificado: 0, reducao: null };
const imposto = (base: number) => regras.emReais(regras.calcularIrrfEmCentavos(regras.emCentavos(base), 0, 0, SO_FAIXAS).irrf);

test('cada faixa da tabela de IRRF: o teto e o primeiro centavo da seguinte', () => {
    // 1ª faixa: até 2.428,80, isenta.
    assert.equal(imposto(0.01), 0);
    assert.equal(imposto(2428.80), 0);
    // 2ª faixa: 7,5% menos 182,16, até 2.826,65 (29,84 no teto).
    assert.equal(imposto(2428.81), 0);
    assert.equal(imposto(2600), 12.84);
    assert.equal(imposto(2826.65), 29.84);
    // 3ª faixa: 15% menos 394,16, até 3.751,05 (168,50 no teto). A tabela é contínua entre as faixas.
    assert.equal(imposto(2826.66), 29.84);
    assert.equal(imposto(3000), 55.84);
    assert.equal(imposto(3751.05), 168.5);
    // 4ª faixa: 22,5% menos 675,49, até 4.664,68 (374,06 no teto).
    assert.equal(imposto(3751.06), 168.5);
    assert.equal(imposto(4000), 224.51);
    assert.equal(imposto(4664.68), 374.06);
    // 5ª faixa: 27,5% menos 908,73, sem teto.
    assert.equal(imposto(4664.69), 374.06);
    assert.equal(imposto(7000), 1016.27);
    assert.equal(imposto(50000), 12841.27);
});

test('a tabela de IRRF publicada tem vigência, faixas crescentes e a última sem teto', () => {
    for (const tabela of TABELAS_IRRF) {
        assert.match(tabela.vigencia_inicio, /^\d{4}-\d{2}-\d{2}$/);
        const tetos = tabela.faixas.slice(0, -1).map((faixa) => faixa.ate as number);
        assert.deepEqual(tetos, [...tetos].sort((a, b) => a - b));
        assert.equal(tabela.faixas.at(-1)!.ate, null);
    }
    assert.equal(TABELA.deducaoPorDependente, 18959);
    assert.equal(TABELA.descontoSimplificado, 60720);
});

test('a redução do imposto: fixa até 5.000,00, decrescente até 7.350,00 e nenhuma depois', () => {
    const reducao = (rendimento: number) => regras.calcularIrrfEmCentavos(regras.emCentavos(rendimento), 0, 0, TABELA).reducao / 100;
    // Até 5.000,00 a redução é de até 312,89, limitada ao imposto (4.392,80 de base dá 312,89).
    assert.equal(reducao(5000), 312.89);
    // Nunca passa do imposto: 4.000,00 tem base 3.392,80 e imposto de 114,76; 3.000,00 está na faixa isenta.
    assert.equal(reducao(4000), 114.76);
    assert.equal(reducao(3000), 0);
    // De 5.000,01 a 7.350,00: 978,62 - 0,133145 x rendimento, contínua com o patamar fixo.
    assert.equal(reducao(5000.01), 312.89);
    assert.equal(reducao(6000), 179.75);
    assert.equal(reducao(6800), 73.23);
    assert.equal(reducao(7349.99), 0.01);
    assert.equal(reducao(7350), 0);
    assert.equal(reducao(7350.01), 0);
    assert.equal(reducao(20000), 0);
});

test('o imposto zera até 5.000,00 de salário e passa a incidir logo depois, sem salto', () => {
    const irrfDoSalario = (salario: number) => regras.calcularHolerite({ salario, dia: DIA }).irrf;
    assert.equal(irrfDoSalario(5000), 0);
    // 5.000,01: base 4.392,81, imposto 312,89 (312,8925), redução 312,89: continua zero.
    assert.equal(irrfDoSalario(5000.01), 0);
    // 5.200,00: base 4.592,80 (o simplificado ainda vence o INSS de 529,51), imposto 357,89 menos redução 286,27.
    assert.equal(irrfDoSalario(5200), 71.62);
    assert.equal(irrfDoSalario(7350), regras.calcularHolerite({ salario: 7350, dia: DIA }).irrf);
    // Acima de 7.350,00 não há redução: 10.000,00 tem INSS 988,09, base 9.011,91 e imposto 27,5% - 908,73 = 1.569,55.
    assert.equal(irrfDoSalario(10000), 1569.55);
});

test('rendimento zero ou negativo não gera IRRF', () => {
    assert.deepEqual(regras.calcularIrrfEmCentavos(0, 0, 0, TABELA), { baseDeCalculo: 0, impostoDaTabela: 0, reducao: 0, irrf: 0 });
    assert.equal(regras.calcularHolerite({ salario: 0, dia: DIA }).irrf, 0);
});

test('tabela de IRRF nova entra pela vigência, e data anterior à primeira é recusada', () => {
    const futura: TabelaIrrf = { ...TABELA, vigencia_inicio: '2027-01-01', descontoSimplificado: 70000 };
    const tabelas = [...TABELAS_IRRF, futura];
    assert.equal(regras.tabelaIrrfVigente('2026-12-31', tabelas), TABELA);
    assert.equal(regras.tabelaIrrfVigente('2027-01-01', tabelas), futura);
    assert.throws(() => regras.tabelaIrrfVigente('2025-12-31'), /Nenhuma tabela de IRRF vigente/);
    assert.equal(regras.haTabelaDeIrrfVigente('2026-01-01'), true);
    assert.equal(regras.haTabelaDeIrrfVigente('2025-12-31'), false);
    // 6.000,00: o INSS é de 641,51 (vale o de 2026, a única tabela de INSS), então em 2026 valem as
    // deduções legais (base 5.358,49) e em 2027 o simplificado de 700,00 (base 5.300,00).
    assert.equal(regras.calcularHolerite({ salario: 6000, dia: '2026-12-31', tabelasIrrf: tabelas }).bases.irrf, 5358.49);
    assert.equal(regras.calcularHolerite({ salario: 6000, dia: '2027-01-01', tabelasIrrf: tabelas }).bases.irrf, 5300);
});

test('FGTS é 8% da remuneração e aparece como encargo, nunca como desconto', () => {
    const h = regras.calcularHolerite({ salario: 3000, dia: DIA, regime: 'Simples Nacional' });
    assert.equal(h.fgts, 240);
    assert.deepEqual(h.rubricas.filter((r) => r.codigo === 'FGTS'), [{ codigo: 'FGTS', descricao: 'FGTS', tipo: 'encargo', valor: 240, referencia: '8%' }]);
    assert.equal(h.rubricas.some((r) => r.tipo === 'desconto' && r.codigo === 'FGTS'), false);
    assert.equal(h.netSalary, 3000 - h.inss - h.irrf, 'o FGTS não sai do líquido');
    assert.equal(h.bases.fgts, 3000);
});

test('encargos da empresa por regime tributário', () => {
    const salario = 4000;
    const encargos = (regime: regras.RegimeTributario | null) => regras.calcularHolerite({ salario, dia: DIA, regime }).rubricas.filter((r) => r.tipo === 'encargo');
    // Simples Nacional: a contribuição patronal vem dentro do DAS, só resta o FGTS.
    assert.deepEqual(encargos('Simples Nacional').map((r) => [r.codigo, r.valor]), [['FGTS', 320]]);
    // Lucro Presumido, Lucro Real e sem regime informado: CPP 20% + RAT 2% + terceiros 5,8%.
    for (const regime of ['Lucro Presumido', 'Lucro Real', null] as const) {
        assert.deepEqual(encargos(regime).map((r) => [r.codigo, r.valor, r.referencia]), [
            ['FGTS', 320, '8%'], ['INSS_PATRONAL', 800, '20%'], ['RAT', 80, '2%'], ['TERCEIROS', 232, '5,8%'],
        ], String(regime));
    }
    assert.equal(regras.calcularHolerite({ salario, dia: DIA, regime: 'Simples Nacional' }).employerCharges, 320);
    assert.equal(regras.calcularHolerite({ salario, dia: DIA, regime: 'Lucro Real' }).employerCharges, 1432);
});

test('horas extras valem 150% ou 200% da hora (salário / carga semanal x 5) e entram nas bases', () => {
    // 4.000,00 em 40 h semanais: divisor 200, hora de 20,00. 3 h a 50% = 90,00; 2 h a 100% = 80,00.
    const h = regras.calcularHolerite({ salario: 4000, dia: DIA, ponto: { faltas: 0, horasExtras50Min: 180, horasExtras100Min: 120 } });
    const proventos = h.rubricas.filter((r) => r.tipo === 'provento');
    assert.deepEqual(proventos.map((r) => [r.codigo, r.valor, r.referencia]), [['SALARIO', 4000, '30 dias'], ['HORA_EXTRA_50', 90, '03:00'], ['HORA_EXTRA_100', 80, '02:00']]);
    assert.equal(h.bases.fgts, 4170);
    assert.equal(h.fgts, 333.6);
    // 44 h semanais: divisor 220, hora de 18,18 (4.000 / 220); 1 h a 50% = 27,27.
    const h44 = regras.calcularHolerite({ salario: 4000, dia: DIA, cargaSemanalHoras: 44, ponto: { faltas: 0, horasExtras50Min: 60, horasExtras100Min: 0 } });
    assert.equal(h44.rubricas.find((r) => r.codigo === 'HORA_EXTRA_50')!.valor, 27.27);
    // Sem vínculo CLT não há hora extra.
    assert.equal(regras.calcularHolerite({ salario: 4000, dia: DIA, tipoContrato: 'PJ', ponto: { faltas: 0, horasExtras50Min: 600, horasExtras100Min: 0 } }).rubricas.length, 1);
});

test('falta desconta 1/30 do salário por dia e reduz as bases de INSS, FGTS e IRRF', () => {
    const h = regras.calcularHolerite({ salario: 3000, dia: DIA, ponto: { faltas: 2, horasExtras50Min: 0, horasExtras100Min: 0 } });
    const falta = h.rubricas.find((r) => r.codigo === 'FALTAS')!;
    assert.deepEqual([falta.tipo, falta.valor, falta.referencia], ['desconto', 200, '2 dias']);
    assert.equal(h.bases.fgts, 2800);
    assert.equal(h.fgts, 224);
    assert.equal(h.inss, regras.calcularHolerite({ salario: 2800, dia: DIA }).inss);
    assert.equal(regras.calcularHolerite({ salario: 3000, dia: DIA, ponto: { faltas: 1, horasExtras50Min: 0, horasExtras100Min: 0 } }).rubricas.find((r) => r.codigo === 'FALTAS')!.referencia, '1 dia');
    // Mais faltas que o mês não passam do salário.
    assert.equal(regras.calcularHolerite({ salario: 3000, dia: DIA, ponto: { faltas: 40, horasExtras50Min: 0, horasExtras100Min: 0 } }).bases.fgts, 0);
});

test('adiantamento, VR e plano de saúde descontam o valor lançado, e o VT o menor entre o custo e 6% do salário', () => {
    const lancamentos = { adiantamento: 500, valeTransporte: 400, valeRefeicao: 150.5, planoSaude: 120 };
    const h = regras.calcularHolerite({ salario: 3000, dia: DIA, lancamentos });
    const descontos = Object.fromEntries(h.rubricas.filter((r) => r.tipo === 'desconto').map((r) => [r.codigo, r.valor]));
    assert.deepEqual(descontos, { INSS: 248.6, ADIANTAMENTO: 500, VALE_TRANSPORTE: 180, VALE_REFEICAO: 150.5, PLANO_SAUDE: 120 });
    // Custo do vale abaixo de 6% (180,00): desconta só o custo.
    assert.equal(regras.calcularHolerite({ salario: 3000, dia: DIA, lancamentos: { ...lancamentos, valeTransporte: 90 } }).rubricas.find((r) => r.codigo === 'VALE_TRANSPORTE')!.valor, 90);
    // Esses descontos não são dedutíveis: a base do IRRF e o INSS ficam como sem eles.
    const sem = regras.calcularHolerite({ salario: 3000, dia: DIA });
    assert.equal(h.bases.irrf, sem.bases.irrf);
    assert.equal(h.inss, sem.inss);
    assert.equal(h.netSalary, regras.emReais(300000 - 24860 - 50000 - 18000 - 15050 - 12000));
});

test('PJ e estágio não têm IRRF nem FGTS, mas os lançamentos valem', () => {
    const h = regras.calcularHolerite({ salario: 8000, dia: DIA, tipoContrato: 'PJ', lancamentos: { adiantamento: 1000, valeTransporte: 0, valeRefeicao: 0, planoSaude: 0 } });
    assert.deepEqual([h.inss, h.irrf, h.fgts, h.employerCharges, h.netSalary], [0, 0, 0, 0, 7000]);
    assert.deepEqual(h.bases, { inss: 0, fgts: 0, irrf: 0 });
});

test('o salário de contribuição do INSS pára no teto da tabela', () => {
    assert.equal(regras.calcularHolerite({ salario: 12000, dia: DIA, tabelasInss: TABELAS_INSS }).bases.inss, 8475.55);
    assert.equal(regras.calcularHolerite({ salario: 12000, dia: DIA }).bases.fgts, 12000);
});

// ---- Eventos do ponto: faltas e horas extras a partir dos dias apurados ----------------------

const dia = (data: string, extra: Partial<DiaApurado> = {}): DiaApurado => ({
    data,
    marcas: { entrada: 480, pausa: 720, retorno: 780, saida: 1020 },
    status: 'ok', trabalhadoMin: 480, atrasoMin: 0, pendenteMin: 0, excedenteMin: 0,
    statusFinal: 'ok', aberto: false, previstoMin: 480,
    ...extra,
});
const SEM_MARCAS = { entrada: null, pausa: null, retorno: null, saida: null };

test('o ponto vira faltas e horas extras: domingo a 100%, o resto a 50%', () => {
    const dias = [
        dia('2026-10-05', { excedenteMin: 90 }),
        dia('2026-10-06', { marcas: SEM_MARCAS, trabalhadoMin: null, statusFinal: 'falta', status: 'falta' }),
        dia('2026-10-10', { statusFinal: 'fim_de_semana', excedenteMin: 240 }), // sábado
        dia('2026-10-11', { statusFinal: 'fim_de_semana', excedenteMin: 120 }), // domingo
        dia('2026-10-07', { marcas: SEM_MARCAS, trabalhadoMin: null, statusFinal: 'justificado' }),
    ];
    assert.deepEqual(eventosDoPonto(dias, null), { eventos: { faltas: 1, horasExtras50Min: 330, horasExtras100Min: 120 }, temMarcacoes: true });
});

test('dia depois do desligamento não conta, e sem nenhuma marcação no mês não há falta descontada', () => {
    const falta = (data: string) => dia(data, { marcas: SEM_MARCAS, trabalhadoMin: null, statusFinal: 'falta', status: 'falta' });
    const dias = [dia('2026-10-01'), falta('2026-10-02'), falta('2026-10-05'), falta('2026-10-06')];
    assert.equal(eventosDoPonto(dias, '2026-10-02').eventos.faltas, 1);
    assert.equal(eventosDoPonto(dias, null).eventos.faltas, 3);
    const semPonto = eventosDoPonto([falta('2026-10-01'), falta('2026-10-02')], null);
    assert.deepEqual(semPonto, { eventos: { faltas: 0, horasExtras50Min: 0, horasExtras100Min: 0 }, temMarcacoes: false });
});
