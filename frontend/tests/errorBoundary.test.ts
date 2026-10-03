// Resposta fora do contrato derruba só a tela: o menu continua visível e há como recarregar.
import { after, before, beforeEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { dom } from './support/jsdom.ts';
import { createElement, act, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createServer, type ViteDevServer } from 'vite';

// O AuthProvider limpa chaves legadas do localStorage ao montar.
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });

let server: ViteDevServer;
let Harness: ComponentType<{ initialPath: string }>;
const originalFetch = globalThis.fetch;

const colaborador = { id: 1, nome: 'Ana Ficticia', email: 'ana@exemplo.invalid', cpf: '000.000.000-00', status: 'Ativo' };
const sessaoDoAdmin = { id: 1, nome: 'Admin Ficticio', perfil: 'Administrador', empresa_nome: 'Empresa Ficticia Alfa Ltda', funcionario_id: null, avatar: null };

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

before(async () => {
  // O cookie de CSRF é o que diz ao AuthProvider que há uma sessão a confirmar.
  document.cookie = 'hrflow_csrf=token-ficticio; Path=/';
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true, ws: false }, appType: 'custom' });
  const [{ default: Employees }, { default: Layout }, { AuthProvider }, { default: UiProviders }] = await Promise.all([
    server.ssrLoadModule('/src/pages/Admin/Employees.tsx'),
    server.ssrLoadModule('/src/layouts/Layout.tsx'),
    server.ssrLoadModule('/src/contexts/AuthContext.tsx'),
    server.ssrLoadModule('/src/components/ui/UiProviders.tsx'),
  ]);
  const page = (path: string | undefined, element: unknown, index = false) =>
    createElement(Route, { path, index, element: element as never });
  Harness = ({ initialPath }) => createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
    createElement(MemoryRouter, { initialEntries: [initialPath] },
      createElement(AuthProvider, null,
        createElement(UiProviders, null,
          createElement(Routes, null,
            createElement(Route, { path: '/admin', element: createElement(Layout) },
              page(undefined, createElement('p', null, 'Tela inicial'), true),
              page('colaboradores', createElement(Employees))))))));
});

after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
  dom.window.close();
});

beforeEach(() => { globalThis.fetch = originalFetch; });

const apiFalsa = (lista: unknown[]) => (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.endsWith('/api/auth/sessao')) return json(sessaoDoAdmin);
  if (url.includes('/api/funcionarios')) return new Response(JSON.stringify(lista), { status: 200, headers: { 'X-Total-Count': String(lista.length) } });
  if (url.includes('/api/estrutura/')) return json([]);
  throw new Error(`chamada inesperada: ${url}`);
}) as typeof fetch;

const montar = async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(Harness, { initialPath: '/admin/colaboradores' })); });
  return { host, root };
};

const link = (host: HTMLElement, rotulo: string) =>
  [...host.querySelectorAll('a')].find((anchor) => anchor.textContent?.includes(rotulo));

test('resposta fora do contrato mostra "Algo deu errado" com botão de recarregar e o menu continua visível', async () => {
  // Um objeto onde o front espera o texto do nome: o React recusa desenhá-lo.
  globalThis.fetch = apiFalsa([{ ...colaborador, nome: { primeiro: 'Ana' } }]);
  const erros = mock.method(console, 'error', () => {});
  try {
    const { host, root } = await montar();

    const alerta = host.querySelector('[role="alert"]');
    assert.match(alerta?.textContent ?? '', /Algo deu errado/);
    const recarregar = [...host.querySelectorAll('button')].find((botao) => botao.textContent === 'Recarregar a página');
    assert.ok(recarregar, 'o fallback deve oferecer o botão de recarregar');

    // O menu e o cabeçalho ficaram de pé: a falha foi contida em volta do conteúdo.
    assert.ok(link(host, 'Dashboard'), 'o menu lateral continua visível');
    assert.ok(link(host, 'Meu Perfil'));
    assert.match(host.textContent ?? '', /Admin Ficticio/);
    assert.ok(erros.mock.callCount() > 0, 'a falha é registrada no console');

    // Trocar de tela pelo menu sai do estado de erro.
    await act(async () => { link(host, 'Dashboard')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
    assert.equal(host.querySelector('[role="alert"]'), null);
    assert.match(host.textContent ?? '', /Tela inicial/);

    await act(async () => root.unmount());
    host.remove();
  } finally {
    erros.mock.restore();
  }
});

test('com a resposta no contrato a tela abre normalmente, sem o fallback', async () => {
  globalThis.fetch = apiFalsa([colaborador]);
  const { host, root } = await montar();
  assert.equal(host.querySelector('[role="alert"]'), null);
  assert.doesNotMatch(host.textContent ?? '', /Algo deu errado/);
  assert.match(host.textContent ?? '', /Ana Ficticia/);
  await act(async () => root.unmount());
  host.remove();
});
