// Login: contrato do formulário (rótulo, id, name, autocomplete), alerta de erro, título por rota.
import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, botaoPorTexto, clicar, createElement, desmontarTudo, dom, esperar, iniciarVite, montar } from './support/ui.ts';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { novoQueryClient } from './support/consulta.ts';
import { precarregarTelas } from './support/rotas.ts';
import type { ComponentType } from 'react';
import type { ViteDevServer } from 'vite';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });

let server: ViteDevServer;
let App: ComponentType;
let AuthProvider: ComponentType<{ children: unknown }>;
let UiProviders: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;
let chamadas: { caminho: string; corpo?: unknown }[] = [];

const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

before(async () => {
  server = await iniciarVite();
  await precarregarTelas(server);
  ({ default: App } = await server.ssrLoadModule('/src/App.tsx'));
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  dom.window.scrollTo = () => {};
  document.cookie = 'hrflow_csrf=; Max-Age=0; Path=/';
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = new URL(String(entrada), 'http://localhost').pathname;
    chamadas.push({ caminho, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (caminho === '/api/auth/login') return json(401, { erro: 'E-mail ou senha incorretos.' });
    return json(404, { erro: 'rota inesperada no teste' });
  }) as typeof fetch;
});
after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
});
afterEach(async () => {
  chamadas = [];
  await desmontarTudo();
});

const abrirRota = async (rota: string) => {
  const cliente = novoQueryClient();
  const host = await montar(createElement(QueryClientProvider, { client: cliente },
    createElement(MemoryRouter, { initialEntries: [rota] },
      createElement(AuthProvider, null, createElement(UiProviders, null, createElement(App))))));
  // As telas do App carregam sob demanda.
  await esperar(300);
  return host;
};

test('todo campo do login tem id, name e um <label for> apontando para ele', async () => {
  const host = await abrirRota('/login');
  const campos = [...host.querySelectorAll<HTMLInputElement>('form input')];
  assert.deepEqual(campos.map((c) => c.name), ['email', 'senha']);
  for (const campo of campos) {
    assert.ok(campo.id, `${campo.name} tem id`);
    const rotulo = host.querySelector(`label[for="${campo.id}"]`);
    assert.ok(rotulo, `${campo.name} tem label`);
  }
  assert.deepEqual(campos.map((c) => host.querySelector(`label[for="${c.id}"]`)!.textContent), ['E-mail*', 'Senha*']);
});

test('e-mail e senha declaram autocomplete para o gerenciador de senhas', async () => {
  const host = await abrirRota('/login');
  assert.equal(host.querySelector<HTMLInputElement>('[name="email"]')!.autocomplete, 'username');
  assert.equal(host.querySelector<HTMLInputElement>('[name="senha"]')!.autocomplete, 'current-password');
  assert.equal(host.querySelector<HTMLInputElement>('[name="email"]')!.type, 'email');
  assert.equal(host.querySelector<HTMLInputElement>('[name="senha"]')!.type, 'password');
});

test('a tela de login não tem link morto (href="#") e tem um único <main> e um único <h1>', async () => {
  const host = await abrirRota('/login');
  const mortos = [...host.querySelectorAll('a')].filter((a) => ['#', ''].includes(a.getAttribute('href') ?? ''));
  assert.deepEqual(mortos.map((a) => a.outerHTML), []);
  assert.equal(host.querySelectorAll('main').length, 1);
  assert.equal(host.querySelectorAll('h1').length, 1);
  assert.doesNotMatch(host.textContent ?? '', /HRflow|Introduza|aceder|Utilizador/);
});

test('o botão de acesso envia e-mail e senha e a falha aparece em um alerta, sem perder o que foi digitado', async () => {
  const host = await abrirRota('/login');
  const preencher = async (nome: string, valor: string) => {
    const input = host.querySelector<HTMLInputElement>(`[name="${nome}"]`)!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, valor);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  };
  await preencher('email', 'ana@exemplo.invalid');
  await preencher('senha', 'senha-errada');
  const enviar = botaoPorTexto(host, /Acessar sistema/);
  assert.equal(enviar.type, 'submit');
  await clicar(enviar);
  await esperar(20);

  assert.deepEqual(chamadas.find((c) => c.caminho === '/api/auth/login')?.corpo, { email: 'ana@exemplo.invalid', senha: 'senha-errada' });
  assert.equal(host.querySelector('[role="alert"]')?.textContent, 'E-mail ou senha incorretos.');
  assert.equal(host.querySelector<HTMLInputElement>('[name="email"]')!.value, 'ana@exemplo.invalid');
  assert.equal(botaoPorTexto(host, /Acessar sistema/).disabled, false, 'o botão volta a aceitar o envio');
});

test('o título da aba muda a cada rota pública', async () => {
  for (const [rota, titulo] of [
    ['/login', 'Entrar | HRFlow'],
    ['/termos', 'Termos de Uso | HRFlow'],
    ['/privacidade', 'Política de Privacidade | HRFlow'],
    ['/', 'Gestão inteligente de RH | HRFlow'],
  ] as const) {
    await abrirRota(rota);
    assert.equal(document.title, titulo, rota);
    await desmontarTudo();
  }
});
