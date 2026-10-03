// Enquanto a sessão é confirmada no servidor a rota protegida mostra um aviso, nunca uma tela em branco.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { dom } from './support/jsdom.ts';
import { createElement, act, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createServer, type ViteDevServer } from 'vite';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });

let server: ViteDevServer;
let Harness: ComponentType;
const originalFetch = globalThis.fetch;

before(async () => {
  document.cookie = 'hrflow_csrf=token-ficticio; Path=/';
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true }, appType: 'custom' });
  const [{ default: App }, { AuthProvider }] = await Promise.all([
    server.ssrLoadModule('/src/App.tsx'),
    server.ssrLoadModule('/src/contexts/AuthContext.tsx'),
  ]);
  Harness = () => createElement(QueryClientProvider, { client: new QueryClient() },
    createElement(MemoryRouter, { initialEntries: ['/admin'] },
      createElement(AuthProvider, null, createElement(App))));
});

after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
  dom.window.close();
});

test('com a confirmação da sessão pendente aparece "Verificando sua sessão..."', async () => {
  // A API não responde: a sessão fica em confirmação.
  let liberar: () => void = () => {};
  globalThis.fetch = (() => new Promise((_resolve, rejeitar) => { liberar = () => rejeitar(new TypeError('Failed to fetch')); })) as typeof fetch;

  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(Harness)); });

  const aviso = host.querySelector('[role="status"]');
  assert.match(aviso?.textContent ?? '', /Verificando sua sessão\.\.\./);

  await act(async () => { liberar(); });
  assert.equal(host.querySelector('[role="status"]'), null, 'o aviso sai quando a confirmação termina');
  await act(async () => root.unmount());
  host.remove();
});
