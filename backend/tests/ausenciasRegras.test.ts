// Regras de férias e afastamentos sem banco: período aquisitivo, saldo, prazo e duração.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calcularSaldo, diasCorridos, diasNoIntervalo, motivoDeRecusaDoPedido, periodosCompletos, situacaoDoTipo, sobrepoe, somarAnos, somarDias,
} from '../modules/ausencias/ausencias.regras.ts';

const SEM_PEDIDOS = { aprovadas: 0, emAnalise: 0 };

test('os dias do período contam o primeiro e o último', () => {
    assert.equal(diasCorridos('2026-10-05', '2026-10-05'), 1);
    assert.equal(diasCorridos('2026-10-05', '2026-10-14'), 10);
    assert.equal(diasCorridos('2026-02-27', '2026-03-02'), 4);
    assert.equal(somarDias('2026-10-31', 1), '2026-11-01');
    assert.equal(somarDias('2026-01-01', -1), '2025-12-31');
});

test('somar anos mantém o dia e cai em 28 de fevereiro quando o ano não é bissexto', () => {
    assert.equal(somarAnos('2024-01-15', 2), '2026-01-15');
    assert.equal(somarAnos('2024-02-29', 1), '2025-02-28');
    assert.equal(somarAnos('2024-02-29', 4), '2028-02-29');
});

test('o direito nasce no aniversário da admissão, não um dia antes', () => {
    assert.equal(periodosCompletos('2024-01-15', '2025-01-14'), 0);
    assert.equal(periodosCompletos('2024-01-15', '2025-01-15'), 1);
    assert.equal(periodosCompletos('2024-01-15', '2026-10-03'), 2);
    assert.equal(periodosCompletos('2026-10-01', '2026-10-03'), 0);
});

test('o saldo é 30 dias por período completo menos o que já foi pedido, e o período em curso é o seguinte', () => {
    const saldo = calcularSaldo('2024-01-15', '2026-10-03', { aprovadas: 10, emAnalise: 5 });
    assert.deepEqual(saldo, {
        admissao: '2024-01-15',
        periodoAquisitivo: { inicio: '2026-01-15', fim: '2027-01-14' },
        periodosCompletos: 2,
        diasAdquiridos: 60,
        diasAprovados: 10,
        diasEmAnalise: 5,
        saldo: 45,
        // O primeiro período (2024-01-15 a 2025-01-14) ainda tem 15 dias: venceu o prazo de 12 meses depois dele.
        prazoParaGozo: '2026-01-14',
        vencido: true,
    });
});

test('o prazo para gozo é o do período mais antigo que ainda tem dias', () => {
    const consumido = calcularSaldo('2024-01-15', '2026-10-03', { aprovadas: 30, emAnalise: 0 });
    assert.equal(consumido.saldo, 30);
    assert.equal(consumido.prazoParaGozo, '2027-01-14');
    assert.equal(consumido.vencido, false);

    const tudo = calcularSaldo('2024-01-15', '2026-10-03', { aprovadas: 60, emAnalise: 0 });
    assert.equal(tudo.saldo, 0);
    assert.equal(tudo.prazoParaGozo, null);
    assert.equal(tudo.vencido, false);
});

test('quem ainda não completou um ano não tem saldo, e sem admissão não há como contar', () => {
    const novo = calcularSaldo('2026-06-01', '2026-10-03', SEM_PEDIDOS);
    assert.equal(novo.saldo, 0);
    assert.deepEqual(novo.periodoAquisitivo, { inicio: '2026-06-01', fim: '2027-05-31' });
    assert.equal(novo.prazoParaGozo, null);

    const sem = calcularSaldo(null, '2026-10-03', { aprovadas: 0, emAnalise: 0 });
    assert.deepEqual({ saldo: sem.saldo, periodoAquisitivo: sem.periodoAquisitivo, admissao: sem.admissao }, { saldo: 0, periodoAquisitivo: null, admissao: null });
});

test('o saldo nunca fica negativo', () => {
    assert.equal(calcularSaldo('2024-01-15', '2026-10-03', { aprovadas: 90, emAnalise: 0 }).saldo, 0);
});

test('os dias de um período dentro de outro contam só o que cai nele', () => {
    assert.equal(diasNoIntervalo('2026-10-26', '2026-11-04', '2026-10-01', '2026-10-31'), 6);
    assert.equal(diasNoIntervalo('2026-10-26', '2026-11-04', '2026-11-01', '2026-11-30'), 4);
    assert.equal(diasNoIntervalo('2026-10-26', '2026-11-04', '2026-12-01', '2026-12-31'), 0);
    assert.equal(diasNoIntervalo('2026-09-20', '2026-12-31', '2026-10-01', '2026-10-31'), 31);
});

test('sobrepor vale também para um único dia em comum', () => {
    const base = { inicio: '2026-10-10', fim: '2026-10-20' };
    assert.equal(sobrepoe(base, { inicio: '2026-10-20', fim: '2026-10-25' }), true);
    assert.equal(sobrepoe(base, { inicio: '2026-10-21', fim: '2026-10-25' }), false);
    assert.equal(sobrepoe(base, { inicio: '2026-10-01', fim: '2026-10-09' }), false);
    assert.equal(sobrepoe(base, { inicio: '2026-10-12', fim: '2026-10-13' }), true);
});

test('férias começam hoje ou depois e têm de 5 a 30 dias', () => {
    const ferias = (inicio: string, fim: string) => motivoDeRecusaDoPedido({ tipo: 'Férias', inicio, fim, anexado: false }, '2026-10-03');
    assert.equal(ferias('2026-10-03', '2026-10-17'), null);
    assert.match(ferias('2026-10-02', '2026-10-17')!, /começar hoje ou depois/);
    assert.match(ferias('2026-10-05', '2026-10-08')!, /mínimo 5 dias/);
    assert.equal(ferias('2026-10-05', '2026-10-09'), null);
    assert.equal(ferias('2026-10-05', '2026-11-03'), null);
    assert.match(ferias('2026-10-05', '2026-11-04')!, /máximo 30 dias/);
});

test('licença pode ser retroativa, mas a médica e o acidente exigem o anexo', () => {
    const pedido = (tipo: Parameters<typeof motivoDeRecusaDoPedido>[0]['tipo'], anexado: boolean) =>
        motivoDeRecusaDoPedido({ tipo, inicio: '2026-09-01', fim: '2026-09-03', anexado }, '2026-10-03');
    assert.match(pedido('Licença Médica', false)!, /atestado/);
    assert.equal(pedido('Licença Médica', true), null);
    assert.match(pedido('Acidente de Trabalho', false)!, /boletim/);
    assert.equal(pedido('Licença Paternidade', false), null);
    assert.equal(pedido('Outros', false), null);
    assert.match(motivoDeRecusaDoPedido({ tipo: 'Licença Maternidade', inicio: '2026-01-01', fim: '2027-01-01', anexado: false }, '2026-10-03')!, /máximo 365 dias/);
});

test('só férias e licenças mudam a situação do colaborador', () => {
    assert.equal(situacaoDoTipo('Férias'), 'Férias');
    assert.equal(situacaoDoTipo('Licença Médica'), 'Afastado');
    assert.equal(situacaoDoTipo('Acidente de Trabalho'), 'Afastado');
    assert.equal(situacaoDoTipo('Outros'), null);
});
