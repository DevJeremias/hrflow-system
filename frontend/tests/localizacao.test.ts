import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PRAZO_DA_LOCALIZACAO_MS, obterLocalizacao } from '../src/utils/localizacao.ts';

type Sucesso = (posicao: { coords: { latitude: number; longitude: number } }) => void;
type Falha = (erro: { code: number }) => void;

describe('captura da localização para o ponto', () => {
  it('resolve com as coordenadas e pede alta precisão com prazo', async () => {
    let opcoes: PositionOptions | undefined;
    const localizacao = await obterLocalizacao({
      getCurrentPosition: (sucesso: Sucesso, _falha: Falha, o?: PositionOptions) => {
        opcoes = o;
        sucesso({ coords: { latitude: -1.45, longitude: -48.5 } });
      },
    } as unknown as Geolocation);
    assert.deepEqual(localizacao, { lat: -1.45, lng: -48.5 });
    assert.equal(opcoes?.enableHighAccuracy, true);
    assert.equal(opcoes?.timeout, PRAZO_DA_LOCALIZACAO_MS);
  });

  const falhas: Record<string, [number, RegExp]> = {
    'permissão negada': [1, /Permita o acesso à sua localização/],
    'posição indisponível': [2, /Verifique o GPS/],
    'prazo esgotado': [3, /a tempo/],
  };
  for (const [nome, [codigo, mensagem]] of Object.entries(falhas)) {
    it(`rejeita com texto claro quando há ${nome}`, async () => {
      await assert.rejects(
        obterLocalizacao({ getCurrentPosition: (_s: Sucesso, falha: Falha) => falha({ code: codigo }) } as unknown as Geolocation),
        mensagem,
      );
    });
  }

  it('rejeita quando o navegador não tem geolocalização', async () => {
    await assert.rejects(obterLocalizacao(undefined), /não suporta geolocalização/);
  });
});
