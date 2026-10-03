// Regras puras da apuração do ponto (ponto.regras.ts): sem banco, sem relógio, sem HTTP.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apurarDia, apurarMes, cargaDiariaMin, formatarMinutos, totalizarMes, validarDecisao } from '../modules/ponto/ponto.regras.ts';
import type { Jornada, Marcacao } from '../modules/ponto/ponto.regras.ts';

const h = (hora: number, minuto = 0) => hora * 60 + minuto;

// 40 horas semanais: 8 horas por dia útil, entrada às 08:00, tolerância de 10 minutos.
const jornada: Jornada = { entradaMin: h(8), toleranciaMin: 10, cargaDiariaMin: cargaDiariaMin(40) };

const dia = (...marcas: Array<[Marcacao['tipo'], number]>): Marcacao[] => marcas.map(([tipo, minuto]) => ({ tipo, minuto }));
const completo = dia(['Entrada', h(8)], ['Pausa Almoço', h(12)], ['Retorno Almoço', h(13)], ['Saída', h(17)]);

describe('cargaDiariaMin', () => {
    it('divide a carga semanal pelos cinco dias úteis', () => {
        assert.equal(cargaDiariaMin(40), 480);
        assert.equal(cargaDiariaMin(44), 528);
        assert.equal(cargaDiariaMin(30), 360);
    });
});

describe('apurarDia', () => {
    it('dia completo: soma as duas metades e fecha sem atraso nem saldo', () => {
        assert.deepEqual(apurarDia(completo, jornada), {
            status: 'ok', trabalhadoMin: 480, atrasoMin: 0, pendenteMin: 0, excedenteMin: 0,
        });
    });

    it('sem almoço: horas são saída menos entrada', () => {
        const resultado = apurarDia(dia(['Entrada', h(8)], ['Saída', h(16)]), jornada);
        assert.equal(resultado.status, 'ok');
        assert.equal(resultado.trabalhadoMin, 480);
    });

    it('sem saída: o dia fica incompleto e não soma horas nem pendência', () => {
        const resultado = apurarDia(dia(['Entrada', h(8)], ['Pausa Almoço', h(12)], ['Retorno Almoço', h(13)]), jornada);
        assert.deepEqual(resultado, { status: 'incompleto', trabalhadoMin: null, atrasoMin: 0, pendenteMin: 0, excedenteMin: 0 });
    });

    it('pausa sem retorno também é incompleto, mesmo com saída', () => {
        const resultado = apurarDia(dia(['Entrada', h(8)], ['Pausa Almoço', h(12)], ['Saída', h(17)]), jornada);
        assert.equal(resultado.status, 'incompleto');
        assert.equal(resultado.trabalhadoMin, null);
    });

    it('atraso dentro da tolerância não conta', () => {
        const resultado = apurarDia(dia(['Entrada', h(8, 10)], ['Pausa Almoço', h(12)], ['Retorno Almoço', h(13)], ['Saída', h(17)]), jornada);
        assert.equal(resultado.status, 'ok');
        assert.equal(resultado.atrasoMin, 0);
    });

    it('atraso fora da tolerância conta inteiro, e não só o que passou dela', () => {
        const resultado = apurarDia(dia(['Entrada', h(8, 11)], ['Pausa Almoço', h(12)], ['Retorno Almoço', h(13)], ['Saída', h(17)]), jornada);
        assert.equal(resultado.status, 'atraso');
        assert.equal(resultado.atrasoMin, 11);
        // 07h49 trabalhadas: 11 minutos abaixo da carga, fora da tolerância de 10.
        assert.equal(resultado.trabalhadoMin, 469);
        assert.equal(resultado.pendenteMin, 11);
    });

    it('chegar antes do horário não é atraso', () => {
        assert.equal(apurarDia(dia(['Entrada', h(7, 30)], ['Saída', h(16, 30)]), jornada).atrasoMin, 0);
    });

    it('falta: dia encerrado sem nenhuma marcação deve a carga inteira', () => {
        assert.deepEqual(apurarDia([], jornada), { status: 'falta', trabalhadoMin: null, atrasoMin: 0, pendenteMin: 480, excedenteMin: 0 });
    });

    it('hoje sem marcações ainda não é falta', () => {
        assert.deepEqual(apurarDia([], jornada, { encerrado: false }), { status: 'ok', trabalhadoMin: null, atrasoMin: 0, pendenteMin: 0, excedenteMin: 0 });
    });

    it('hoje sem saída ainda não é incompleto, mas o atraso já aparece', () => {
        assert.equal(apurarDia(dia(['Entrada', h(8)]), jornada, { encerrado: false }).status, 'ok');
        assert.equal(apurarDia(dia(['Entrada', h(9)]), jornada, { encerrado: false }).status, 'atraso');
    });

    it('saldo dentro da tolerância é zerado e fora dela vira excedente ou pendência', () => {
        const comSaida = (saida: number) => apurarDia(dia(['Entrada', h(8)], ['Pausa Almoço', h(12)], ['Retorno Almoço', h(13)], ['Saída', saida]), jornada);
        assert.deepEqual([comSaida(h(17, 10)).excedenteMin, comSaida(h(16, 50)).pendenteMin], [0, 0]);
        assert.equal(comSaida(h(18)).excedenteMin, 60);
        assert.equal(comSaida(h(16)).pendenteMin, 60);
    });

    it('lê marcações fora de ordem e repetidas: primeira entrada, última saída', () => {
        const baguncado = dia(['Saída', h(16)], ['Entrada', h(8)], ['Entrada', h(9)], ['Saída', h(17)]);
        assert.equal(apurarDia(baguncado, jornada).trabalhadoMin, 540);
    });

    it('ordem impossível (saída antes da entrada) é incompleto', () => {
        assert.equal(apurarDia(dia(['Entrada', h(17)], ['Saída', h(8)]), jornada).status, 'incompleto');
    });
});

describe('apurarMes', () => {
    // Outubro de 2026 começa numa quinta-feira.
    const dias = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'];
    const marcacoesDe = (data: string): Marcacao[] => (data === '2026-10-01' ? completo : []);
    const apurar = (justificativas: Record<string, 'pendente' | 'aprovada' | 'recusada'> = {}, opcoes = { hoje: '2026-10-06', admissao: null as string | null }) => apurarMes(
        dias.map((data) => ({ data, marcacoes: marcacoesDe(data), justificativa: justificativas[data] ?? null })),
        jornada,
        opcoes
    );
    const statusDe = (resultado: ReturnType<typeof apurar>) => resultado.map((d) => d.statusFinal);

    it('classifica cada dia: ok, falta, fim de semana, hoje e futuro', () => {
        assert.deepEqual(statusDe(apurar()), ['ok', 'falta', 'fim_de_semana', 'fim_de_semana', 'falta', 'ok', 'ok']);
    });

    it('hoje e os dias futuros ficam abertos e sem pendência', () => {
        const resultado = apurar();
        assert.deepEqual(resultado.map((d) => d.aberto), [false, false, false, false, false, true, true]);
        assert.deepEqual(resultado.slice(5).map((d) => d.pendenteMin), [0, 0]);
    });

    it('justificativa aprovada vira "justificado" e abona a pendência; pendente e recusada não', () => {
        assert.equal(apurar({ '2026-10-02': 'aprovada' })[1].statusFinal, 'justificado');
        assert.equal(apurar({ '2026-10-02': 'aprovada' })[1].pendenteMin, 0);
        assert.equal(apurar({ '2026-10-02': 'pendente' })[1].statusFinal, 'falta');
        assert.equal(apurar({ '2026-10-02': 'recusada' })[1].pendenteMin, 480);
    });

    it('dias antes da admissão não são falta e não entram na carga prevista', () => {
        const resultado = apurar({}, { hoje: '2026-10-06', admissao: '2026-10-05' });
        assert.equal(resultado[1].statusFinal, 'ok');
        assert.equal(resultado[1].previstoMin, 0);
        assert.equal(resultado[4].statusFinal, 'falta');
    });

    it('marcações no fim de semana são horas excedentes', () => {
        const resultado = apurarMes(
            [{ data: '2026-10-03', marcacoes: dia(['Entrada', h(9)], ['Saída', h(13)]), justificativa: null }],
            jornada,
            { hoje: '2026-10-06', admissao: null }
        );
        assert.equal(resultado[0].statusFinal, 'fim_de_semana');
        assert.equal(resultado[0].trabalhadoMin, 240);
        assert.equal(resultado[0].excedenteMin, 240);
        assert.equal(resultado[0].previstoMin, 0);
    });
});

describe('totalizarMes', () => {
    it('soma o mês e separa as semanas de segunda a domingo', () => {
        const todos = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
        const resultado = apurarMes(
            todos.map((data) => ({ data, marcacoes: data === '2026-10-01' || data === '2026-10-02' ? completo : [], justificativa: null })),
            jornada,
            { hoje: '2026-10-09', admissao: null }
        );
        const { semanas, mes } = totalizarMes(resultado);
        // Outubro de 2026: dias 1 a 4 (quinta a domingo) e depois cinco semanas inteiras ou parciais.
        assert.deepEqual(semanas.map((s) => [s.de, s.ate]), [
            ['2026-10-01', '2026-10-04'], ['2026-10-05', '2026-10-11'], ['2026-10-12', '2026-10-18'],
            ['2026-10-19', '2026-10-25'], ['2026-10-26', '2026-10-31'],
        ]);
        assert.equal(mes.previstoMin, 22 * 480);
        assert.equal(mes.trabalhadoMin, 960);
        // Faltas de 05 a 08 (hoje, o dia 09, ainda está aberto): 4 dias úteis.
        assert.equal(mes.faltas, 4);
        assert.equal(mes.pendenteMin, 4 * 480);
        assert.equal(semanas[0].trabalhadoMin, 960);
        assert.equal(semanas[1].faltas, 4);
        assert.equal(semanas[2].faltas, 0);
    });
});

describe('formatarMinutos e validarDecisao', () => {
    it('formata horas além de 99', () => {
        assert.equal(formatarMinutos(0), '00:00');
        assert.equal(formatarMinutos(469), '07:49');
        assert.equal(formatarMinutos(220 * 60), '220:00');
    });

    it('a recusa exige o motivo; a aprovação não', () => {
        assert.deepEqual(validarDecisao('aprovada', null), { dados: null });
        assert.deepEqual(validarDecisao('recusada', 'Sem atestado.'), { dados: 'Sem atestado.' });
        assert.ok('erro' in validarDecisao('recusada', null));
    });
});
