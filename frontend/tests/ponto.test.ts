import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatarDataDeBelem, formatarHoraDeBelem, proximosTiposDePonto } from '../src/utils/ponto.ts';
import type { PointRecord } from '../src/services/pontoService.ts';

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

describe('formatação do relógio em Belém', () => {
  it('formata hora e data em Belém mesmo com o processo em outro fuso', () => {
    const fusoOriginal = process.env.TZ;
    process.env.TZ = 'Pacific/Honolulu';
    try {
      const data = new Date('2026-03-11T01:30:00.000Z');
      assert.equal(formatarHoraDeBelem(data), '22:30:00');
      assert.match(formatarDataDeBelem(data), /terça-feira, 10 de março/);
    } finally {
      if (fusoOriginal === undefined) delete process.env.TZ;
      else process.env.TZ = fusoOriginal;
    }
  });
});
