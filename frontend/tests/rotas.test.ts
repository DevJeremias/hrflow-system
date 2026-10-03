// Rotas do app: página 404, redirecionamento do /login para quem já entrou e volta ao destino
// original depois do login.
import { dom } from './support/jsdom.ts';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { createServer, type ViteDevServer } from 'vite';
import { assentar, comConsulta } from './support/consulta.ts';
import { precarregarTelas } from './support/rotas.ts';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });

let server: ViteDevServer;
let App: typeof import('../src/App.tsx').default;
let AuthProvider: typeof import('../src/contexts/AuthContext.tsx').AuthProvider;
const originalFetch = globalThis.fetch;

before(async () => {
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  await precarregarTelas(server);
  App = (await server.ssrLoadModule('/src/App.tsx')).default;
  AuthProvider = (await server.ssrLoadModule('/src/contexts/AuthContext.tsx')).AuthProvider;
});

after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
  dom.window.close();
});

const json = (corpo: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json', ...headers } });

const sessao = (perfil: string) => ({ id: 1, nome: 'Rita Teste', perfil, empresa_nome: 'Empresa Ficticia Alfa Ltda', funcionario_id: perfil === 'Colaborador' ? 7 : null, avatar: null });

// `entrar` simula o login que o servidor aceita: ele passa a emitir o cookie de CSRF e a sessão.
const instalarApi = (perfil: 'Administrador' | 'Colaborador', { logado }: { logado: boolean }) => {
  const estado = { logado };
  if (logado) document.cookie = 'hrflow_csrf=teste; Path=/';
  else document.cookie = 'hrflow_csrf=; Max-Age=0; Path=/';
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const caminho = new URL(String(entrada), 'http://localhost').pathname;
    switch (caminho) {
      case '/api/auth/login':
        estado.logado = true;
        document.cookie = 'hrflow_csrf=teste; Path=/';
        return json({ perfil, nome: 'Rita Teste' });
      case '/api/auth/sessao': return json(sessao(perfil));
      default:
        // A folha da competência ainda não processada: a API responde 404.
        if (caminho.startsWith('/api/folha/competencias/')) return new Response(JSON.stringify({ erro: 'Folha não processada.' }), { status: 404 });
        return json([], { 'X-Total-Count': '0' });
    }
  }) as typeof fetch;
};

const Localizacao = () => {
  const { pathname, search } = useLocation();
  return createElement('output', { 'data-rota': `${pathname}${search}` });
};

const abrir = async (rota: string | { pathname: string; state?: unknown }) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const arvore: ReactElement = comConsulta(
    createElement(MemoryRouter, { initialEntries: [rota] },
      createElement(AuthProvider, null, createElement(App), createElement(Localizacao))));
  await act(async () => { root.render(arvore); });
  await assentar(300);
  return { host, root, rota: () => host.querySelector('output')?.getAttribute('data-rota') };
};

const fechar = async ({ host, root }: { host: HTMLElement; root: { unmount: () => void } }) => {
  await act(async () => root.unmount());
  host.remove();
};

const digitar = async (input: HTMLInputElement, valor: string) => {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set;
  assert.ok(setter);
  await act(async () => {
    setter.call(input, valor);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};

test('/admin/xyz mostra a página 404 dentro do painel, com link de volta', async () => {
  instalarApi('Administrador', { logado: true });
  const tela = await abrir('/admin/xyz');
  assert.match(tela.host.textContent ?? '', /Página não encontrada/);
  assert.match(tela.host.textContent ?? '', /Dashboard/, 'o menu do painel continua na tela');
  const voltar = [...tela.host.querySelectorAll('a')].find((a) => /Voltar ao painel/.test(a.textContent ?? ''));
  assert.equal(voltar?.getAttribute('href'), '/admin');
  assert.equal(tela.rota(), '/admin/xyz', 'a rota não foi trocada pela landing');
  await fechar(tela);
});

test('/meu-painel/xyz mostra a 404 para o colaborador, com link para o painel dele', async () => {
  instalarApi('Colaborador', { logado: true });
  const tela = await abrir('/meu-painel/xyz');
  assert.match(tela.host.textContent ?? '', /Página não encontrada/);
  const voltar = [...tela.host.querySelectorAll('a')].find((a) => /Voltar ao painel/.test(a.textContent ?? ''));
  assert.equal(voltar?.getAttribute('href'), '/meu-painel');
  await fechar(tela);
});

test('um endereço qualquer sem sessão mostra a 404 com link para o início, não a landing', async () => {
  instalarApi('Administrador', { logado: false });
  const tela = await abrir('/qualquer-coisa');
  assert.match(tela.host.textContent ?? '', /Página não encontrada/);
  assert.doesNotMatch(tela.host.textContent ?? '', /Gestão de RH/);
  const voltar = [...tela.host.querySelectorAll('a')].find((a) => /Voltar ao início/.test(a.textContent ?? ''));
  assert.equal(voltar?.getAttribute('href'), '/');
  await fechar(tela);
});

test('quem já está logado e abre /login vai para o próprio painel', async () => {
  instalarApi('Administrador', { logado: true });
  const tela = await abrir('/login');
  assert.equal(tela.rota(), '/admin');
  await fechar(tela);
});

test('o deep link /admin/folha sem sessão vai ao login e volta a /admin/folha depois de entrar', async () => {
  instalarApi('Administrador', { logado: false });
  const tela = await abrir('/admin/folha?mes=2026-10');
  assert.equal(tela.rota(), '/login', 'sem sessão, o destino é o login');

  await digitar(tela.host.querySelector<HTMLInputElement>('input[type="email"]') as HTMLInputElement, 'rita@exemplo.invalid');
  await digitar(tela.host.querySelector<HTMLInputElement>('input[type="password"]') as HTMLInputElement, 'senha-ficticia');
  const formulario = tela.host.querySelector('form');
  assert.ok(formulario);
  await act(async () => { formulario.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await assentar(300);

  assert.equal(tela.rota(), '/admin/folha?mes=2026-10');
  assert.match(tela.host.textContent ?? '', /Gestão de Folha/);
  await fechar(tela);
});

test('o login sem destino guardado leva ao painel do perfil', async () => {
  instalarApi('Colaborador', { logado: false });
  const tela = await abrir('/login');
  await digitar(tela.host.querySelector<HTMLInputElement>('input[type="email"]') as HTMLInputElement, 'ana@exemplo.invalid');
  await digitar(tela.host.querySelector<HTMLInputElement>('input[type="password"]') as HTMLInputElement, 'senha-ficticia');
  const formulario = tela.host.querySelector('form');
  assert.ok(formulario);
  await act(async () => { formulario.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await assentar(300);
  assert.equal(tela.rota(), '/meu-painel');
  await fechar(tela);
});

test('um destino de outro perfil guardado no login cai no painel de quem entrou', async () => {
  instalarApi('Colaborador', { logado: false });
  const tela = await abrir({ pathname: '/login', state: { from: '/admin/folha' } });
  await digitar(tela.host.querySelector<HTMLInputElement>('input[type="email"]') as HTMLInputElement, 'ana@exemplo.invalid');
  await digitar(tela.host.querySelector<HTMLInputElement>('input[type="password"]') as HTMLInputElement, 'senha-ficticia');
  const formulario = tela.host.querySelector('form');
  assert.ok(formulario);
  await act(async () => { formulario.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await assentar(300);
  assert.equal(tela.rota(), '/meu-painel', 'o ProtectedRoute manda o colaborador de /admin para o painel dele');
  await fechar(tela);
});
