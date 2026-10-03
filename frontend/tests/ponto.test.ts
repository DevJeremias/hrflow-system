import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diaTemMarcacao, formatarDataNoFuso, formatarHoraNoFuso, hojeNoFuso, podeJustificar, proximosTiposDePonto, rotuloDoDia } from '../src/utils/ponto.ts';
import type { HistoryDay, PointRecord } from '../src/services/pontoService.ts';

const registro = (type: string): PointRecord => ({ id: type, type, time: '08:00:00', date: '2026-03-10' });

describe('fluxo de marcações no painel', () => {
  it('permite escolher entre iniciar a pausa ou encerrar após a Entrada', () => {
    assert.deepEqual(proximosTiposDePonto([registro('Entrada')]), ['Pausa Almoço', 'Saída']);
  });

  it('encerra depois da Saída e mantém a pausa como etapa obrigatória se iniciada', () => {
    assert.deepEqual(proximosTiposDePonto([registro('Pausa Almoço')]), ['Retorno Almoço']);
    assert.deepEqual(proximosTiposDePonto([registro('Retorno Almoço')]), ['Saída']);
    assert.deepEqual(proximosTiposDePonto([registro('Saída')]), []);
  });
});

describe('formatação do relógio no fuso da empresa', () => {
  it('formata hora e data em Belém mesmo com o processo em outro fuso', () => {
    const fusoOriginal = process.env.TZ;
    process.env.TZ = 'Pacific/Honolulu';
    try {
      const data = new Date('2026-03-11T01:30:00.000Z');
      assert.equal(formatarHoraNoFuso(data), '22:30:00');
      assert.match(formatarDataNoFuso(data), /terça-feira, 10 de março/);
      // Manaus está uma hora atrás de Belém: o mesmo instante mostra 21:30.
      assert.equal(formatarHoraNoFuso(data, 'America/Manaus'), '21:30:00');
    } finally {
      if (fusoOriginal === undefined) delete process.env.TZ;
      else process.env.TZ = fusoOriginal;
    }
  });
});

const dia = (parcial: Partial<HistoryDay>): HistoryDay => ({
  id: '2026-10-07', date: '2026-10-07', entry: '--:--', lunchOut: '--:--', lunchIn: '--:--', exit: '--:--', totalHours: '--:--',
  status: 'falta', open: false, delay: '00:00', note: '', noteStatus: null, noteReply: null, negativeAdjust: '08:00', positiveAdjust: '00:00',
  ...parcial,
});

describe('espelho de ponto', () => {
  it('o dia de hoje é o do fuso da empresa, não o do relógio do navegador', () => {
    assert.equal(hojeNoFuso('America/Belem', new Date('2026-10-08T02:30:00.000Z')), '2026-10-07');
    assert.equal(hojeNoFuso('America/Belem', new Date('2026-10-08T03:00:00.000Z')), '2026-10-08');
    // Às 03:30Z já é dia 8 em Belém, mas em Manaus ainda é dia 7.
    assert.equal(hojeNoFuso('America/Manaus', new Date('2026-10-08T03:30:00.000Z')), '2026-10-07');
    assert.equal(hojeNoFuso(undefined, new Date('2026-10-08T03:30:00.000Z')), '2026-10-08');
  });

  it('qualquer dia útil que já começou pode ser justificado, com ou sem marcação', () => {
    assert.equal(podeJustificar(dia({ status: 'falta' }), '2026-10-20'), true);
    assert.equal(podeJustificar(dia({ status: 'ok', entry: '08:00', exit: '17:00' }), '2026-10-20'), true);
    assert.equal(podeJustificar(dia({ date: '2026-10-20', status: 'ok', open: true }), '2026-10-20'), true);
  });

  it('fim de semana e dia futuro não abrem justificativa, a não ser que já haja uma', () => {
    assert.equal(podeJustificar(dia({ date: '2026-10-03', status: 'fim_de_semana' }), '2026-10-20'), false);
    assert.equal(podeJustificar(dia({ date: '2026-10-21', status: 'ok', open: true }), '2026-10-20'), false);
    assert.equal(podeJustificar(dia({ date: '2026-10-03', status: 'fim_de_semana', note: 'Plantão.' }), '2026-10-20'), true);
  });

  it('o dia em aberto não é anunciado como OK', () => {
    assert.equal(rotuloDoDia({ status: 'ok', open: true }), '—');
    assert.equal(rotuloDoDia({ status: 'ok', open: false }), 'OK');
    assert.equal(rotuloDoDia({ status: 'atraso', open: true }), 'Atraso');
    assert.equal(rotuloDoDia({ status: 'fim_de_semana', open: false }), 'Fim de semana');
    assert.equal(rotuloDoDia({ status: 'justificado', open: false }), 'Justificado');
  });

  it('reconhece o dia que tem alguma marcação', () => {
    assert.equal(diaTemMarcacao(dia({})), false);
    assert.equal(diaTemMarcacao(dia({ entry: '08:00' })), true);
  });
});
