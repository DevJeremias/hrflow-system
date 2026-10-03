// O sino do cabeçalho: o selo conta os avisos não lidos, o painel lista os mais recentes, ler um aviso o
// marca como lido e leva à tela dele. Painel de divulgação: Esc e clique fora fecham e o foco volta ao botão.
import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, botaoPorTexto, clicar, createElement, desmontarTudo, dom, esperar, iniciarVite, montar, teclar } from './support/ui.ts';
import { comConsulta } from './support/consulta.ts';
import { rotuloDoSino } from '../src/utils/notificacoes.ts';
import type { ComponentType } from 'react';
import type { ViteDevServer } from 'vite';

let server: ViteDevServer;
let Sino: ComponentType;
const originalFetch = globalThis.fetch;

type Pedido = { metodo: string; caminho: string };
let pedidos: Pedido[] = [];
let lista: { naoLidas: number; itens: Record<string, unknown>[] };
let falhaNaLista = false;

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const aviso = (id: number, parcial: Record<string, unknown> = {}) => ({
  id, tipo: 'justificativa', titulo: 'Justificativa aprovada', mensagem: 'A sua justificativa do dia 10/03/2026 foi aprovada.',
  link: '/meu-painel', lida: false, criadaEm: '2026-03-11T15:30:00.000Z', ...parcial,
});

before(async () => {
  server = await iniciarVite();
  ({ default: Sino } = await server.ssrLoadModule('/src/components/Notificacoes/SinoDeNotificacoes.tsx'));
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = String(entrada).replace(/^\/api/, '');
    const metodo = (init?.method ?? 'GET').toUpperCase();
    pedidos.push({ metodo, caminho });
    if (metodo === 'GET' && caminho.startsWith('/notificacoes')) return falhaNaLista ? json({ erro: 'Falha.' }, 500) : json(lista);
    if (metodo === 'POST' && caminho === '/notificacoes/lidas') return json({ naoLidas: 0 });
    const marcada = /^\/notificacoes\/(\d+)\/lida$/.exec(caminho);
    if (metodo === 'POST' && marcada) return json({ naoLidas: lista.itens.filter((n) => !n.lida && n.id !== Number(marcada[1])).length });
    return json({ erro: 'rota inesperada no teste' }, 404);
  }) as typeof fetch;
});
after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
  dom.window.close();
});
afterEach(async () => {
  await desmontarTudo();
  pedidos = [];
  falhaNaLista = false;
});

const abrir = async () => {
  const host = await montar(comConsulta(createElement(MemoryRouter, { initialEntries: ['/admin'] },
    createElement('main', null,
      createElement(Sino),
      createElement(Routes, null,
        createElement(Route, { path: '/admin', element: createElement('p', null, 'Tela admin') }),
        createElement(Route, { path: '/meu-painel', element: createElement('p', null, 'Tela do colaborador') }))))));
  await esperar(20);
  return host;
};
const sino = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('button[aria-expanded]')!;

test('o nome do botão diz quantas notificações não foram lidas', () => {
  assert.equal(rotuloDoSino(0), 'Notificações');
  assert.equal(rotuloDoSino(1), 'Notificações: 1 não lida');
  assert.equal(rotuloDoSino(3), 'Notificações: 3 não lidas');
});

test('aprovada uma justificativa, o sino mostra "1 não lida" e o selo traz o número', async () => {
  lista = { naoLidas: 1, itens: [aviso(1)] };
  const host = await abrir();
  assert.equal(sino(host).getAttribute('aria-label'), 'Notificações: 1 não lida');
  assert.equal(sino(host).textContent, '1');
  assert.equal(sino(host).getAttribute('aria-expanded'), 'false');
});

test('sem avisos não lidos não há selo, e o painel diz que não há nada', async () => {
  lista = { naoLidas: 0, itens: [] };
  const host = await abrir();
  assert.equal(sino(host).getAttribute('aria-label'), 'Notificações');
  assert.equal(sino(host).textContent, '');
  await clicar(sino(host));
  assert.match(host.textContent ?? '', /Nenhuma notificação por enquanto/);
});

test('o selo limita a contagem a 9+', async () => {
  lista = { naoLidas: 12, itens: [aviso(1)] };
  const host = await abrir();
  assert.equal(sino(host).textContent, '9+');
  assert.equal(sino(host).getAttribute('aria-label'), 'Notificações: 12 não lidas');
});

test('o painel lista os avisos, com data no fuso e o ponto de "não lida", e liga o botão ao painel', async () => {
  lista = { naoLidas: 1, itens: [aviso(2), aviso(1, { titulo: 'Holerite de 02/2026 disponível', mensagem: 'O seu holerite já pode ser consultado.', lida: true, link: '/meu-painel/holerites' })] };
  const host = await abrir();
  await clicar(sino(host));
  assert.equal(sino(host).getAttribute('aria-expanded'), 'true');
  const painel = host.querySelector(`#${sino(host).getAttribute('aria-controls')}`)!;
  assert.equal(painel.getAttribute('aria-label'), 'Notificações');
  const itens = [...painel.querySelectorAll('li')];
  assert.equal(itens.length, 2);
  assert.match(itens[0].textContent ?? '', /Justificativa aprovada/);
  assert.match(itens[0].textContent ?? '', /11\/03\/2026 às 12:30/, 'o horário de Belém, não o UTC');
  assert.equal(itens[0].querySelectorAll('[aria-label="Não lida"]').length, 1);
  assert.equal(itens[1].querySelectorAll('[aria-label="Não lida"]').length, 0);
});

test('abrir um aviso o marca como lido, fecha o painel e leva à tela dele', async () => {
  lista = { naoLidas: 1, itens: [aviso(5)] };
  const host = await abrir();
  await clicar(sino(host));
  await clicar(botaoPorTexto(host, /Justificativa aprovada/));
  await esperar(20);
  assert.deepEqual(pedidos.filter((p) => p.metodo === 'POST'), [{ metodo: 'POST', caminho: '/notificacoes/5/lida' }]);
  assert.match(host.textContent ?? '', /Tela do colaborador/);
  assert.equal(host.querySelector('section[aria-label="Notificações"]'), null, 'o painel fechou');
  assert.equal(sino(host).getAttribute('aria-label'), 'Notificações', 'o selo zerou com a contagem do servidor');
});

test('marcar todas como lidas zera o selo', async () => {
  lista = { naoLidas: 2, itens: [aviso(1), aviso(2)] };
  const host = await abrir();
  await clicar(sino(host));
  await clicar(botaoPorTexto(host, /Marcar todas como lidas/));
  await esperar(20);
  assert.deepEqual(pedidos.filter((p) => p.metodo === 'POST'), [{ metodo: 'POST', caminho: '/notificacoes/lidas' }]);
  assert.equal(sino(host).getAttribute('aria-label'), 'Notificações');
  assert.equal([...host.querySelectorAll('button')].some((b) => /Marcar todas/.test(b.textContent ?? '')), false);
});

test('Esc fecha o painel e devolve o foco ao botão; clicar fora também fecha', async () => {
  lista = { naoLidas: 1, itens: [aviso(1)] };
  const host = await abrir();
  await clicar(sino(host));
  sino(host).focus();
  await teclar(document, 'Escape');
  assert.equal(host.querySelector('section[aria-label="Notificações"]'), null);
  assert.equal(document.activeElement, sino(host));

  await clicar(sino(host));
  assert.ok(host.querySelector('section[aria-label="Notificações"]'));
  await act(async () => { document.body.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true })); });
  assert.equal(host.querySelector('section[aria-label="Notificações"]'), null);
});

test('falha ao carregar mostra o alerta com "Tentar novamente" dentro do painel', async () => {
  falhaNaLista = true;
  lista = { naoLidas: 0, itens: [] };
  const host = await abrir();
  assert.equal(sino(host).getAttribute('aria-label'), 'Notificações');
  await clicar(sino(host));
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /Não foi possível carregar as notificações/);
  falhaNaLista = false;
  await clicar(botaoPorTexto(host, /Tentar novamente/));
  await esperar(20);
  assert.equal(host.querySelector('[role="alert"]'), null);
});
