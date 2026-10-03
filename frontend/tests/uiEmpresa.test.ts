// Tela "Dados da empresa" no design system: campos com id, name e rótulo; o RH só consulta; o Administrador salva.
import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, botaoPorTexto, createElement, desmontarTudo, dom, esperar, iniciarVite, montar } from './support/ui.ts';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import type { ViteDevServer } from 'vite';
import { novoQueryClient } from './support/consulta.ts';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });

let server: ViteDevServer;
let Company: ComponentType;
let AuthProvider: ComponentType<{ children: unknown }>;
let UiProviders: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;

let perfil: 'Administrador' | 'RH' = 'RH';
let gravacoes: Record<string, unknown>[] = [];
const EMPRESA = { nome: 'Empresa Ficticia Alfa', razao_social: 'Empresa Ficticia Alfa Ltda', cnpj: '11222333000181', regime_tributario: 'Lucro Real', fuso: 'America/Belem' };

const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

before(async () => {
  document.cookie = 'hrflow_csrf=token-ficticio; Path=/';
  server = await iniciarVite();
  Company = (await server.ssrLoadModule('/src/pages/Admin/Company.tsx')).default;
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = new URL(String(entrada), 'http://localhost').pathname.replace(/^\/api/, '');
    const metodo = (init?.method ?? 'GET').toUpperCase();
    if (caminho === '/auth/sessao') return json(200, { id: 1, nome: 'Rita Ficticia', perfil, empresa_nome: 'Empresa Ficticia Alfa', funcionario_id: null, avatar: null });
    if (caminho === '/empresa' && metodo === 'GET') return json(200, EMPRESA);
    if (caminho === '/empresa' && metodo === 'PUT') {
      const corpo = JSON.parse(String(init?.body));
      gravacoes.push(corpo);
      return json(200, { ...EMPRESA, ...corpo, cnpj: String(corpo.cnpj).replace(/\D/g, '') });
    }
    return json(404, { erro: 'rota inesperada' });
  }) as typeof fetch;
});
after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
});
afterEach(async () => {
  await desmontarTudo();
  gravacoes = [];
});

const abrir = async () => {
  const host = await montar(createElement(QueryClientProvider, { client: novoQueryClient() },
    createElement(MemoryRouter, null, createElement(AuthProvider, null, createElement(UiProviders, null, createElement(Company))))));
  for (let i = 0; i < 3; i += 1) await esperar(20);
  return host;
};

test('os quatro campos têm id, name e rótulo, a página tem um único h1 e o título da aba', async () => {
  const host = await abrir();
  assert.equal(document.title, 'Dados da empresa | HRFlow');
  assert.equal(host.querySelectorAll('h1').length, 1);
  assert.equal(host.querySelector('main'), null);
  const controles = [...host.querySelectorAll<HTMLInputElement>('input, select')];
  assert.deepEqual(controles.map((c) => c.name), ['razaoSocial', 'cnpj', 'regime', 'fuso']);
  for (const controle of controles) {
    assert.ok(controle.id, `${controle.name} tem id`);
    assert.ok(host.querySelector(`label[for="${controle.id}"]`), `${controle.name} tem <label for>`);
  }
});

test('o RH vê os dados desabilitados, com o aviso, e não tem botão de salvar', async () => {
  perfil = 'RH';
  const host = await abrir();
  assert.equal(host.querySelector<HTMLInputElement>('[name="razaoSocial"]')!.value, 'Empresa Ficticia Alfa Ltda');
  assert.equal(host.querySelector<HTMLInputElement>('[name="cnpj"]')!.value, '11.222.333/0001-81');
  for (const controle of host.querySelectorAll<HTMLInputElement>('input, select')) assert.equal(controle.disabled, true, controle.name);
  assert.match(host.textContent ?? '', /Somente o Administrador altera/);
  assert.equal([...host.querySelectorAll('button')].some((b) => /Salvar/.test(b.textContent ?? '')), false);
});

test('o Administrador salva e recebe o aviso de sucesso em uma região de status', async () => {
  perfil = 'Administrador';
  const host = await abrir();
  await act(async () => {
    const campo = host.querySelector<HTMLInputElement>('[name="razaoSocial"]')!;
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(campo, 'Nova Razao Ltda');
    campo.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await act(async () => { botaoPorTexto(host, /Salvar dados/).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
  await esperar(20);
  assert.equal(gravacoes.length, 1);
  assert.equal(gravacoes[0].razao_social, 'Nova Razao Ltda');
  const status = host.querySelector('[role="status"]');
  assert.equal(status?.textContent, 'Dados da empresa salvos.');
});

test('o Administrador escolhe o fuso da empresa e ele segue na gravação', async () => {
  perfil = 'Administrador';
  const host = await abrir();
  const fuso = host.querySelector<HTMLSelectElement>('[name="fuso"]')!;
  assert.equal(fuso.value, 'America/Belem');
  assert.match(fuso.selectedOptions[0].textContent ?? '', /^Belém \(GMT-3\)$/);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!.call(fuso, 'America/Manaus');
    fuso.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await act(async () => { botaoPorTexto(host, /Salvar dados/).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
  await esperar(20);
  assert.equal(gravacoes[0].fuso, 'America/Manaus');
  assert.equal(host.querySelector<HTMLSelectElement>('[name="fuso"]')!.value, 'America/Manaus');
});
