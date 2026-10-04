// Regras do formulário de solicitações (férias e afastamentos): as mesmas que a API aplica, para o erro
// aparecer no campo antes do envio. Funções puras: rodam no Node, sem navegador nem servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAMANHO_MAXIMO_DO_ANEXO, avisoDoSaldo, diasDoPeriodo, rotuloDosDias, tipoDoArquivo, validarArquivo, validarPeriodo } from '../src/utils/solicitacoes.ts';

const HOJE = '2026-10-03';
const arquivo = (name: string, type: string, size: number) => ({ name, type, size });

test('PDF, JPG e PNG de até 5 MB passam; o resto não', () => {
  assert.equal(validarArquivo(arquivo('atestado.pdf', 'application/pdf', 1024)), null);
  assert.equal(validarArquivo(arquivo('foto.jpg', 'image/jpeg', 1024)), null);
  assert.equal(validarArquivo(arquivo('foto.png', 'image/png', TAMANHO_MAXIMO_DO_ANEXO)), null);
  assert.match(validarArquivo(arquivo('foto.png', 'image/png', TAMANHO_MAXIMO_DO_ANEXO + 1))!, /mais de 5 MB/);
  assert.match(validarArquivo(arquivo('animacao.gif', 'image/gif', 1024))!, /PDF, JPG ou PNG/);
  assert.match(validarArquivo(arquivo('planilha.xlsx', 'application/vnd.ms-excel', 1024))!, /PDF, JPG ou PNG/);
  assert.match(validarArquivo(arquivo('vazio.pdf', 'application/pdf', 0))!, /vazio/);
});

test('quando o navegador não informa o tipo, a extensão decide', () => {
  assert.equal(tipoDoArquivo({ name: 'ATESTADO.PDF', type: '' }), 'application/pdf');
  assert.equal(tipoDoArquivo({ name: 'foto.jpeg', type: '' }), 'image/jpeg');
  assert.equal(validarArquivo(arquivo('foto.png', '', 10)), null);
  assert.match(validarArquivo(arquivo('script.exe', '', 10))!, /PDF, JPG ou PNG/);
});

test('os dias do período contam o primeiro e o último', () => {
  assert.equal(diasDoPeriodo('2026-10-05', '2026-10-14'), 10);
  assert.equal(diasDoPeriodo('2026-10-05', '2026-10-05'), 1);
  assert.equal(diasDoPeriodo('2026-10-05', '2026-10-04'), 0);
  assert.equal(diasDoPeriodo('', '2026-10-04'), 0);
  assert.equal(rotuloDosDias(1), '1 dia');
  assert.equal(rotuloDosDias(10), '10 dias');
});

test('término antes do início é erro no campo de término, para qualquer tipo', () => {
  for (const tipo of ['Férias', 'Licença Médica', 'Outros'] as const) {
    assert.deepEqual(validarPeriodo(tipo, '2026-11-10', '2026-11-05', HOJE), { fim: 'A data de término não pode ser anterior à data de início.' });
  }
});

test('as duas datas são obrigatórias', () => {
  assert.deepEqual(validarPeriodo('Férias', '', '', HOJE), { inicio: 'Informe a data de início.', fim: 'Informe a data de término.' });
  assert.deepEqual(validarPeriodo('Outros', '2026-11-01', '', HOJE), { fim: 'Informe a data de término.' });
});

test('férias não começam no passado e têm de 5 a 30 dias', () => {
  assert.deepEqual(validarPeriodo('Férias', '2026-10-02', '2026-10-12', HOJE), { inicio: 'As férias precisam começar hoje ou depois.' });
  assert.deepEqual(validarPeriodo('Férias', '2026-10-03', '2026-10-12', HOJE), {});
  assert.match(validarPeriodo('Férias', '2026-11-01', '2026-11-04', HOJE).fim!, /mínimo 5 dias/);
  assert.deepEqual(validarPeriodo('Férias', '2026-11-01', '2026-11-05', HOJE), {});
  assert.deepEqual(validarPeriodo('Férias', '2026-11-01', '2026-11-30', HOJE), {});
  assert.match(validarPeriodo('Férias', '2026-11-01', '2026-12-01', HOJE).fim!, /máximo 30 dias/);
});

test('uma licença pode ser retroativa, mas não passa de 365 dias', () => {
  assert.deepEqual(validarPeriodo('Licença Médica', '2026-09-01', '2026-09-03', HOJE), {});
  assert.deepEqual(validarPeriodo('Licença Maternidade', '2026-01-01', '2026-12-31', HOJE), {});
  assert.match(validarPeriodo('Licença Maternidade', '2026-01-01', '2027-01-01', HOJE).fim!, /máximo 365 dias/);
});

test('o aviso do saldo explica a falta de admissão e o primeiro ano ainda incompleto', () => {
  const base = { admissao: '2026-06-01', periodoAquisitivo: { inicio: '2026-06-01', fim: '2027-05-31' }, periodosCompletos: 0, diasAdquiridos: 0, diasAprovados: 0, diasEmAnalise: 0, saldo: 0, prazoParaGozo: null, vencido: false };
  assert.match(avisoDoSaldo(base)!, /primeiro período aquisitivo termina em 31\/05\/2027/);
  assert.match(avisoDoSaldo({ ...base, admissao: null, periodoAquisitivo: null })!, /admissão não está cadastrada/);
  assert.equal(avisoDoSaldo({ ...base, periodosCompletos: 1, diasAdquiridos: 30, saldo: 30 }), null);
});
