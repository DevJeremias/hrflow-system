// Como a trilha de auditoria é apresentada: nome das ações e resumo do que mudou. Sem navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumoDaMudanca, rotuloDaAcao } from '../src/utils/auditoria.ts';

test('toda ação que a API grava tem um nome legível, e uma ação desconhecida aparece como veio', () => {
  assert.equal(rotuloDaAcao('funcionario.salario_alterado'), 'Salário alterado');
  assert.equal(rotuloDaAcao('login.falha'), 'Tentativa de entrada recusada');
  assert.equal(rotuloDaAcao('solicitacao.aprovada'), 'Alteração aprovada');
  assert.equal(rotuloDaAcao('algo.novo'), 'algo.novo');
});

test('o resumo mostra o valor de antes e o de depois, com o salário em reais (o espaço de R$ não quebra a linha)', () => {
  assert.deepEqual(resumoDaMudanca({ antes: { salario_base: 3000 }, depois: { salario_base: 7250.5 } }), ['Salário: R$\u00a03.000,00 → R$\u00a07.250,50']);
});

test('cargo e departamento aparecem pelo nome, sem o código', () => {
  const linhas = resumoDaMudanca({
    antes: { cargo_id: 10, cargo: 'Analista', departamento_id: 1, departamento: null },
    depois: { cargo_id: 11, cargo: 'Gerente', departamento_id: 2, departamento: 'Financeiro' },
  });
  assert.deepEqual(linhas, ['Cargo: Analista → Gerente', 'Departamento: vazio → Financeiro']);
});

test('sem o valor de antes só o novo aparece, e datas e competências saem como o brasileiro lê', () => {
  assert.deepEqual(resumoDaMudanca({ antes: null, depois: { competencia: '2026-09', colaboradores: 12, criada: true } }), ['Competência: 09/2026', 'Colaboradores na folha: 12', 'Primeira vez: sim']);
  assert.deepEqual(resumoDaMudanca({ antes: { data_desligamento: null }, depois: { data_desligamento: '2026-09-30' } }), ['Desligamento: vazio → 30/09/2026']);
});

test('o motivo da falha de login e a troca de foto ficam em português, e a foto nunca vira dado', () => {
  assert.deepEqual(resumoDaMudanca({ antes: null, depois: { motivo: 'senha_incorreta' } }), ['Motivo: senha incorreta']);
  assert.deepEqual(resumoDaMudanca({ antes: null, depois: { avatar: 'removido' } }), ['Foto: removida']);
});

test('ação sem detalhe não tem resumo', () => {
  assert.deepEqual(resumoDaMudanca({ antes: null, depois: null }), []);
});
