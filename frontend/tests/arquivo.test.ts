// Entregar o PDF que a API gerou: o link de download e o nome que o servidor sugeriu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dom } from './support/jsdom.ts';
import { baixarArquivo, nomeSugerido } from '../src/utils/arquivo.ts';

test('baixarArquivo clica num link de download com o nome pedido e solta a URL do arquivo', async (t) => {
  const criadas: Blob[] = [];
  const revogadas: string[] = [];
  const clicados: { nome: string; href: string }[] = [];
  t.mock.method(URL, 'createObjectURL', (arquivo: Blob) => { criadas.push(arquivo); return 'blob:ficticio'; });
  t.mock.method(URL, 'revokeObjectURL', (url: string) => { revogadas.push(url); });
  t.mock.method(dom.window.HTMLAnchorElement.prototype, 'click', function click(this: HTMLAnchorElement) { clicados.push({ nome: this.download, href: this.href }); });
  t.mock.timers.enable({ apis: ['setTimeout'] });

  const arquivo = new Blob(['%PDF-1.3']);
  baixarArquivo(arquivo, 'holerites-2026-10.pdf');

  assert.deepEqual(criadas, [arquivo]);
  assert.deepEqual(clicados, [{ nome: 'holerites-2026-10.pdf', href: 'blob:ficticio' }]);
  assert.equal(document.querySelector('a[download]'), null, 'o link some do documento');
  assert.deepEqual(revogadas, [], 'a URL só é solta depois que o download começou');
  t.mock.timers.tick(1000);
  assert.deepEqual(revogadas, ['blob:ficticio']);
});

test('nomeSugerido lê o filename de Content-Disposition e cai no reserva sem ele', () => {
  const com = new Response('', { headers: { 'Content-Disposition': 'attachment; filename="holerite-2026-10-ana.pdf"' } });
  assert.equal(nomeSugerido(com, 'reserva.pdf'), 'holerite-2026-10-ana.pdf');
  assert.equal(nomeSugerido(new Response(''), 'reserva.pdf'), 'reserva.pdf');
  assert.equal(nomeSugerido(null, 'reserva.pdf'), 'reserva.pdf');
});
