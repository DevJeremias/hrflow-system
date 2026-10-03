// Casca da aplicação: skip link, um único <main>, nomes acessíveis e a gaveta do menu no celular.
import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, clicar, createElement, desmontarTudo, dom, esperar, iniciarVite, montar, teclar } from './support/ui.ts';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { novoQueryClient } from './support/consulta.ts';
import { elementosFocaveis } from '../src/hooks/useFocusTrap.ts';
import type { ComponentType } from 'react';
import type { ViteDevServer } from 'vite';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });

let server: ViteDevServer;
let Layout: ComponentType;
let AuthProvider: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;
const matchMediaOriginal = dom.window.matchMedia;

const json = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

before(async () => {
  server = await iniciarVite();
  ({ default: Layout } = await server.ssrLoadModule('/src/layouts/Layout.tsx'));
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
  document.cookie = 'hrflow_csrf=teste';
  globalThis.fetch = (async () => json({ id: 1, nome: 'Rita Teste', perfil: 'RH', empresa_nome: 'Empresa Ficticia Alfa Ltda', funcionario_id: null })) as typeof fetch;
});
after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
});
afterEach(async () => {
  await desmontarTudo();
  dom.window.matchMedia = matchMediaOriginal;
});

const definirTela = (desktop: boolean) => {
  dom.window.matchMedia = ((consulta: string) => ({
    matches: desktop && consulta.includes('min-width: 1024px'),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof dom.window.matchMedia;
};

const abrirCasca = async () => {
  const cliente = novoQueryClient();
  const host = await montar(createElement(QueryClientProvider, { client: cliente },
    createElement(MemoryRouter, { initialEntries: ['/admin'] },
      createElement(AuthProvider, null,
        createElement(Routes, null,
          createElement(Route, { path: '/admin', element: createElement(Layout) },
            createElement(Route, { index: true, element: createElement('p', null, 'Conteúdo da página') })))))));
  await esperar(50);
  return host;
};

const hamburguer = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('button[aria-label="Abrir menu"]')!;
const gaveta = (host: HTMLElement) => host.querySelector<HTMLElement>('aside')!;

test('o skip link é o primeiro elemento focável e leva ao <main id="conteudo">', async () => {
  definirTela(true);
  const host = await abrirCasca();
  const [primeiro] = elementosFocaveis(host);
  assert.equal(primeiro.textContent, 'Ir para o conteúdo');
  assert.equal(primeiro.getAttribute('href'), '#conteudo');
  const principal = host.querySelector('main')!;
  assert.equal(principal.id, 'conteudo');
  assert.equal(principal.tabIndex, -1, 'o destino recebe o foco ao seguir o link');
});

test('há um único <main> e o conteúdo da rota está dentro dele', async () => {
  definirTela(true);
  const host = await abrirCasca();
  assert.equal(host.querySelectorAll('main').length, 1);
  assert.equal(host.querySelector('main')!.textContent, 'Conteúdo da página');
  assert.equal(host.querySelectorAll('header').length, 1);
});

test('hambúrguer e fechar têm nome acessível; todo botão da casca tem nome', async () => {
  definirTela(true);
  const host = await abrirCasca();
  assert.ok(hamburguer(host), 'botão "Abrir menu"');
  assert.equal(hamburguer(host).getAttribute('aria-expanded'), 'false');
  assert.equal(hamburguer(host).getAttribute('aria-controls'), gaveta(host).id);
  assert.ok(gaveta(host).querySelector('button[aria-label="Fechar menu"]'), 'botão "Fechar menu"');
  const semNome = [...host.querySelectorAll('button')].filter((b) => !(b.textContent?.trim() || b.getAttribute('aria-label')));
  assert.deepEqual(semNome.map((b) => b.outerHTML), []);
});

test('o link da página atual tem aria-current="page" e o menu e a gaveta se nomeiam', async () => {
  definirTela(true);
  const host = await abrirCasca();
  const atual = [...host.querySelectorAll('nav a')].filter((a) => a.getAttribute('aria-current') === 'page');
  assert.deepEqual(atual.map((a) => a.textContent), ['Dashboard']);
  assert.equal(host.querySelector('nav')!.getAttribute('aria-label'), 'Menu principal');
  assert.equal(gaveta(host).getAttribute('aria-label'), 'Menu lateral');
});

test('no desktop o menu lateral fica sempre ativo', async () => {
  definirTela(true);
  const host = await abrirCasca();
  assert.equal(gaveta(host).hasAttribute('inert'), false);
});

test('no celular a gaveta fechada é inerte: nenhum link dela recebe foco', async () => {
  definirTela(false);
  const host = await abrirCasca();
  assert.equal(gaveta(host).hasAttribute('inert'), true);
  const links = [...gaveta(host).querySelectorAll('a[href], button')];
  assert.ok(links.length > 0, 'a gaveta tem links');
  assert.ok(links.every((el) => el.closest('[inert]') === gaveta(host)), 'todos estão sob inert');
  assert.deepEqual(elementosFocaveis(host).filter((el) => gaveta(host).contains(el)), [], 'o Tab não alcança nenhum');
});

test('no celular: abrir move o foco para a gaveta e deixa o resto inerte; Esc fecha e devolve o foco ao hambúrguer', async () => {
  definirTela(false);
  const host = await abrirCasca();
  const botao = hamburguer(host);
  botao.focus();
  await clicar(botao);
  await esperar();

  assert.equal(gaveta(host).hasAttribute('inert'), false);
  assert.ok(gaveta(host).contains(document.activeElement), 'o foco está dentro da gaveta');
  assert.equal(host.querySelector('main')!.closest('[inert]') !== null, true, 'o conteúdo fica inerte');
  assert.equal(host.querySelector('header')!.closest('[inert]') !== null, true, 'o cabeçalho fica inerte');

  // Tab no último elemento volta ao primeiro, sem escapar da gaveta.
  const focaveis = elementosFocaveis(gaveta(host));
  focaveis[focaveis.length - 1].focus();
  await teclar(document.activeElement!, 'Tab');
  assert.equal(document.activeElement, focaveis[0]);

  await teclar(document, 'Escape');
  await esperar();
  assert.equal(gaveta(host).hasAttribute('inert'), true, 'fechada outra vez');
  assert.equal(host.querySelector('main')!.closest('[inert]'), null);
  assert.equal(document.activeElement, hamburguer(host));
});

test('o botão Fechar menu também fecha a gaveta e devolve o foco', async () => {
  definirTela(false);
  const host = await abrirCasca();
  hamburguer(host).focus();
  await clicar(hamburguer(host));
  await esperar();
  await clicar(gaveta(host).querySelector('button[aria-label="Fechar menu"]')!);
  await esperar();
  assert.equal(gaveta(host).hasAttribute('inert'), true);
  assert.equal(document.activeElement, hamburguer(host));
  await act(async () => {});
});
