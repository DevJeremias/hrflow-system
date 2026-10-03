// "Esqueci a senha": o pedido do link por e-mail e a tela que o link abre. O token chega no fragmento
// do endereço e vai ao servidor só no corpo do POST.
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
let chamadas: { caminho: string; corpo?: Record<string, unknown> }[] = [];
let respostaDoPedido: () => Response;
let respostaDaRedefinicao: () => Response;

const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const TOKEN = 'a'.repeat(43);

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
    if (caminho === '/api/auth/esqueci-senha') return respostaDoPedido();
    if (caminho === '/api/auth/redefinir-senha') return respostaDaRedefinicao();
    return json(404, { erro: 'rota inesperada no teste' });
  }) as typeof fetch;
});
after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
});
afterEach(async () => {
  chamadas = [];
  respostaDoPedido = () => json(200, { mensagem: 'Se o e-mail estiver cadastrado, enviamos as instruções para redefinir a senha.' });
  respostaDaRedefinicao = () => json(200, { mensagem: 'Senha redefinida. Entre com a nova senha.' });
  await desmontarTudo();
});

const abrirRota = async (rota: string) => {
  const cliente = novoQueryClient();
  const host = await montar(createElement(QueryClientProvider, { client: cliente },
    createElement(MemoryRouter, { initialEntries: [rota] },
      createElement(AuthProvider, null, createElement(UiProviders, null, createElement(App))))));
  await esperar(300);
  return host;
};

const preencher = async (host: HTMLElement, nome: string, valor: string) => {
  const input = host.querySelector<HTMLInputElement>(`[name="${nome}"]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, valor);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};

test('o login leva à tela de "esqueci a senha"', async () => {
  const host = await abrirRota('/login');
  const link = [...host.querySelectorAll('a')].find((a) => /Esqueceu a senha/.test(a.textContent ?? ''));
  assert.equal(link?.getAttribute('href'), '/esqueci-senha');
});

test('o pedido manda o e-mail e confirma sem dizer se a conta existe', async () => {
  const host = await abrirRota('/esqueci-senha');
  assert.equal(document.title, 'Esqueci a senha | HRFlow');
  const campo = host.querySelector<HTMLInputElement>('[name="email"]')!;
  assert.ok(host.querySelector(`label[for="${campo.id}"]`));
  assert.equal(campo.autocomplete, 'username');

  await preencher(host, 'email', 'ana@exemplo.invalid');
  await clicar(botaoPorTexto(host, /Enviar o link/));
  await esperar(20);

  assert.deepEqual(chamadas.find((c) => c.caminho === '/api/auth/esqueci-senha')?.corpo, { email: 'ana@exemplo.invalid' });
  const status = host.querySelector('[role="status"]');
  assert.match(status?.textContent ?? '', /Se o e-mail estiver cadastrado, enviamos as instruções/);
  assert.match(status?.textContent ?? '', /1 hora e só pode ser usado uma vez/);
  assert.equal(host.querySelector('form'), null);

  await clicar(botaoPorTexto(host, /Pedir de novo/));
  assert.ok(host.querySelector('form'), 'volta o formulário');
});

test('sem e-mail habilitado ou com muitos pedidos, o alerta traz a mensagem do servidor', async () => {
  respostaDoPedido = () => json(501, { erro: 'O envio de e-mail não está habilitado neste ambiente. Procure o RH da sua empresa para redefinir a senha.' });
  const host = await abrirRota('/esqueci-senha');
  await preencher(host, 'email', 'ana@exemplo.invalid');
  await clicar(botaoPorTexto(host, /Enviar o link/));
  await esperar(20);
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /Procure o RH da sua empresa/);

  respostaDoPedido = () => json(429, { erro: 'Muitas tentativas.', retryAfterSegundos: 1800 });
  await clicar(botaoPorTexto(host, /Enviar o link/));
  await esperar(20);
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /Tente novamente em 30 minutos/);
});

test('o link do e-mail abre a troca: o token e a nova senha vão no corpo e o aviso leva ao login', async () => {
  const host = await abrirRota(`/redefinir-senha#token=${TOKEN}`);
  assert.equal(document.title, 'Redefinir a senha | HRFlow');
  const campos = [...host.querySelectorAll<HTMLInputElement>('form input')];
  assert.deepEqual(campos.map((c) => c.name), ['novaSenha', 'confirmacao']);
  for (const campo of campos) {
    assert.ok(host.querySelector(`label[for="${campo.id}"]`), campo.name);
    assert.equal(campo.autocomplete, 'new-password');
  }

  await preencher(host, 'novaSenha', 'senha-nova-ficticia');
  await preencher(host, 'confirmacao', 'senha-nova-ficticia');
  await clicar(botaoPorTexto(host, /Salvar a nova senha/));
  await esperar(20);

  assert.deepEqual(chamadas.find((c) => c.caminho === '/api/auth/redefinir-senha')?.corpo, { token: TOKEN, senha: 'senha-nova-ficticia' });
  assert.match(host.querySelector('[role="status"]')?.textContent ?? '', /Entre no HRFlow com a nova senha/);
  await clicar(botaoPorTexto(host, /Ir para o login/));
  await esperar(300);
  assert.equal(document.title, 'Entrar | HRFlow');
});

test('senhas diferentes não chegam ao servidor', async () => {
  const host = await abrirRota(`/redefinir-senha#token=${TOKEN}`);
  await preencher(host, 'novaSenha', 'senha-nova-ficticia');
  await preencher(host, 'confirmacao', 'outra-senha-ficticia');
  await clicar(botaoPorTexto(host, /Salvar a nova senha/));
  await esperar(20);
  assert.equal(host.querySelector('[role="alert"]')?.textContent, 'As senhas não coincidem.');
  assert.equal(chamadas.length, 0);
});

test('link expirado ou já usado mostra o motivo e oferece pedir outro', async () => {
  respostaDaRedefinicao = () => json(400, { erro: 'Este link de redefinição é inválido ou expirou. Peça um novo.' });
  const host = await abrirRota(`/redefinir-senha#token=${TOKEN}`);
  await preencher(host, 'novaSenha', 'senha-nova-ficticia');
  await preencher(host, 'confirmacao', 'senha-nova-ficticia');
  await clicar(botaoPorTexto(host, /Salvar a nova senha/));
  await esperar(20);
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /inválido ou expirou/);
  const pedir = [...host.querySelectorAll('a')].find((a) => /Pedir um novo link/.test(a.textContent ?? ''));
  assert.equal(pedir?.getAttribute('href'), '/esqueci-senha');
});

test('sem o token no endereço a tela não mostra o formulário', async () => {
  const host = await abrirRota('/redefinir-senha');
  assert.equal(host.querySelector('form'), null);
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /link de redefinição está incompleto/);
  assert.equal(chamadas.length, 0);
});
