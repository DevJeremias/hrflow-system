import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement, act, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createServer, type ViteDevServer } from 'vite';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  localStorage: { configurable: true, value: dom.window.localStorage },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
});

let server: ViteDevServer;
let Harness: ComponentType<{ initialPath: string }>;
const originalFetch = globalThis.fetch;

// Fixtures da Alfa: 3 colaboradores ativos, 4 departamentos e 4 cargos.
const resumoDaAlfa = { colaboradoresAtivos: 3, colaboradoresInativos: 1, departamentos: 4, cargos: 4, marcacoesHoje: 2 };
const sessaoDoAdmin = { id: 1, nome: 'Admin Ficticio', perfil: 'Administrador', empresa_nome: 'Empresa Ficticia Alfa Ltda', funcionario_id: null, avatar: null };

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

before(async () => {
  // O cookie de CSRF é o que diz ao AuthProvider que há uma sessão a confirmar.
  document.cookie = 'hrflow_csrf=token-ficticio; Path=/';
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true }, appType: 'custom' });
  const [{ default: Dashboard }, { AuthProvider }] = await Promise.all([
    server.ssrLoadModule('/src/pages/Admin/Dashboard.tsx'),
    server.ssrLoadModule('/src/contexts/AuthContext.tsx'),
  ]);
  const page = (path: string, element: unknown) => createElement(Route, { path, element: element as never });
  Harness = ({ initialPath }) => createElement(QueryClientProvider, { client: new QueryClient() },
    createElement(MemoryRouter, { initialEntries: [initialPath] },
      createElement(AuthProvider, null,
        createElement(Routes, null,
          page('/admin', createElement(Dashboard)),
          page('/admin/colaboradores', createElement('p', null, 'Tela de colaboradores')),
          page('/admin/estrutura', createElement('p', null, 'Tela de estrutura')),
          page('/admin/gestao-ponto', createElement('p', null, 'Tela de ponto'))))));
});

after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
  dom.window.close();
});

beforeEach(() => { globalThis.fetch = originalFetch; });

const renderDashboard = async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(Harness, { initialPath: '/admin' })); });
  return { host, root };
};

const apiFalsa = (resumo: () => Response | Promise<Response>) => (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.endsWith('/api/auth/sessao')) return json(sessaoDoAdmin);
  if (url.endsWith('/api/dashboard/resumo')) return resumo();
  throw new Error(`chamada inesperada: ${url}`);
}) as typeof fetch;

const cartao = (host: HTMLElement, rotulo: string) =>
  [...host.querySelectorAll('a')].find((link) => link.textContent?.includes(rotulo));

test('mostra as contagens reais da API, sem espera artificial', async () => {
  globalThis.fetch = apiFalsa(() => json(resumoDaAlfa));
  const { host, root } = await renderDashboard();
  assert.match(cartao(host, 'Colaboradores')?.textContent ?? '', /^Colaboradores31 inativo$/);
  assert.match(cartao(host, 'Departamentos')?.textContent ?? '', /^Departamentos4$/);
  assert.match(cartao(host, 'Cargos')?.textContent ?? '', /^Cargos Cadastrados4$/);
  assert.match(cartao(host, 'Marcações Hoje')?.textContent ?? '', /^Marcações Hoje2$/);
  assert.doesNotMatch(host.textContent ?? '', /Aprovações Pendentes/);
  await act(async () => root.unmount());
  host.remove();
});

test('cada cartão leva à tela correspondente', async () => {
  const destinos: Array<[string, string]> = [
    ['Colaboradores', 'Tela de colaboradores'],
    ['Departamentos', 'Tela de estrutura'],
    ['Cargos', 'Tela de estrutura'],
    ['Marcações Hoje', 'Tela de ponto'],
  ];
  for (const [rotulo, tela] of destinos) {
    globalThis.fetch = apiFalsa(() => json(resumoDaAlfa));
    const { host, root } = await renderDashboard();
    const link = cartao(host, rotulo);
    assert.ok(link, `o cartão ${rotulo} deve ser um link`);
    await act(async () => { link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
    assert.match(host.textContent ?? '', new RegExp(tela));
    await act(async () => root.unmount());
    host.remove();
  }
});

test('erro de rede mostra o alerta com "Tentar novamente" em vez de zeros, e tentar de novo carrega os dados', async () => {
  globalThis.fetch = apiFalsa(() => { throw new TypeError('Failed to fetch'); });
  const { host, root } = await renderDashboard();
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /Não foi possível conectar ao servidor/);
  assert.equal(cartao(host, 'Colaboradores'), undefined);
  const retry = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Tentar novamente');
  assert.ok(retry, 'o alerta deve oferecer nova tentativa');

  globalThis.fetch = apiFalsa(() => json(resumoDaAlfa));
  await act(async () => { retry.click(); });
  assert.equal(host.querySelector('[role="alert"]'), null);
  assert.match(cartao(host, 'Colaboradores')?.textContent ?? '', /^Colaboradores3/);
  await act(async () => root.unmount());
  host.remove();
});

test('Atividades Recentes mostra texto de estado vazio, nunca uma lista em branco', async () => {
  globalThis.fetch = apiFalsa(() => json(resumoDaAlfa));
  const { host, root } = await renderDashboard();
  assert.match(host.textContent ?? '', /Atividades Recentes/);
  assert.match(host.textContent ?? '', /O histórico de atividades da empresa ainda não está disponível/);
  await act(async () => root.unmount());
  host.remove();
});
