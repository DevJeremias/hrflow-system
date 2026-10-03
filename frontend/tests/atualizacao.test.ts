import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recarregarAposAtualizacao } from '../src/utils/atualizacao.ts';

const ambiente = (inicial: Record<string, string> = {}) => {
  const guardado = { ...inicial };
  let recargas = 0;
  let relogio = 1_000_000;
  return {
    guardado,
    recargas: () => recargas,
    avancar: (ms: number) => { relogio += ms; },
    ambiente: {
      armazenamento: { getItem: (k: string) => guardado[k] ?? null, setItem: (k: string, v: string) => { guardado[k] = v; } },
      recarregar: () => { recargas += 1; },
      agora: () => relogio,
    },
  };
};

describe('recarga após um deploy', () => {
  it('recarrega na primeira falha de carregamento de uma tela', () => {
    const a = ambiente();
    assert.equal(recarregarAposAtualizacao(a.ambiente), true);
    assert.equal(a.recargas(), 1);
  });

  it('não entra em laço: a segunda falha logo em seguida não recarrega', () => {
    const a = ambiente();
    recarregarAposAtualizacao(a.ambiente);
    a.avancar(2_000);
    assert.equal(recarregarAposAtualizacao(a.ambiente), false);
    assert.equal(a.recargas(), 1);
  });

  it('volta a recarregar numa falha muito tempo depois', () => {
    const a = ambiente();
    recarregarAposAtualizacao(a.ambiente);
    a.avancar(60_000);
    assert.equal(recarregarAposAtualizacao(a.ambiente), true);
    assert.equal(a.recargas(), 2);
  });

  it('não recarrega quando o armazenamento da sessão não funciona', () => {
    const a = ambiente();
    const quebrado = { ...a.ambiente, armazenamento: { getItem: () => { throw new Error('bloqueado'); }, setItem: () => {} } };
    assert.equal(recarregarAposAtualizacao(quebrado), false);
    assert.equal(a.recargas(), 0);
  });
});
