// A rota protegida do App: quem entra, quem é mandado ao login, quem volta ao seu painel e o que a
// pessoa vê quando o servidor não consegue confirmar a sessão. Usa o AuthProvider de verdade, com a API simulada.
import { dom, abrirVite, limparTela, simularApi, resposta } from './support/componentes.ts';
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ViteDevServer } from 'vite';

type Perfil = 'Administrador' | 'RH' | 'Colaborador';

let server: ViteDevServer;
let ProtectedRoute: ComponentType<{ children: ReactNode; allowedRoles?: readonly Perfil[] }>;
let AuthProvider: ComponentType<{ children: ReactNode }>;
let restaurarApi: () => void;

before(async () => {
  server = await abrirVite();
  ({ ProtectedRoute } = await server.ssrLoadModule('/src/App.tsx'));
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
});

after(async () => {
  await server.close();
  dom.window.close();
});

afterEach(() => {
  limparTela();
  restaurarApi?.();
});

const sessao = (perfil: Perfil) => ({ id: 3, nome: 'Pessoa Ficticia', perfil, funcionario_id: perfil === 'Colaborador' ? 5 : null, empresa_nome: 'Empresa Ficticia' });

// Com `perfil`, o cookie de CSRF existe e GET /auth/sessao responde com essa pessoa; sem ele, não há sessão.
const montar = (perfil: Perfil | null, allowedRoles?: readonly Perfil[], respostaDaSessao?: () => Parameters<typeof resposta>[0] | Response) => {
  if (perfil) dom.window.document.cookie = 'hrflow_csrf=token-ficticio; path=/';
  const api = simularApi(({ caminho }) => {
    if (caminho === '/auth/sessao') return (respostaDaSessao?.() ?? { corpo: sessao(perfil as Perfil) }) as Response;
    if (caminho === '/auth/logout') return { status: 204 };
    return { status: 404, corpo: { erro: 'rota inesperada no teste' } };
  });
  restaurarApi = api.restaurar;
  render(createElement(MemoryRouter, { initialEntries: ['/protegida'] },
    createElement(QueryClientProvider, { client: new QueryClient() },
      createElement(AuthProvider, null,
        createElement(Routes, null,
          createElement(Route, { path: '/protegida', element: createElement(ProtectedRoute, { allowedRoles }, createElement('p', null, 'Conteúdo protegido')) }),
          createElement(Route, { path: '/login', element: createElement('p', null, 'Tela de login') }),
          createElement(Route, { path: '/admin', element: createElement('p', null, 'Painel da gestão') }),
          createElement(Route, { path: '/meu-painel', element: createElement('p', null, 'Painel do colaborador') }),
        )))));
  return api;
};

test('sem sessão, vai ao login sem chamar a API', async () => {
  const { chamadas } = montar(null);
  assert.ok(await screen.findByText('Tela de login'));
  assert.equal(screen.queryByText('Conteúdo protegido'), null);
  assert.deepEqual(chamadas, []);
});

test('enquanto confirma a sessão, não mostra nem o conteúdo nem o login', async () => {
  let liberar: () => void = () => {};
  const esperando = new Promise<void>((resolve) => { liberar = resolve; });
  const { chamadas } = montar('RH', ['RH'], () => esperando.then(() => ({ corpo: sessao('RH') })) as unknown as Response);
  await waitFor(() => assert.equal(chamadas.length, 1));
  assert.equal(document.body.textContent, '');
  liberar();
  assert.ok(await screen.findByText('Conteúdo protegido'));
});

test('perfil permitido vê o conteúdo', async () => {
  montar('RH', ['Administrador', 'RH']);
  assert.ok(await screen.findByText('Conteúdo protegido'));
});

test('sem lista de perfis, qualquer pessoa com sessão entra', async () => {
  montar('Colaborador');
  assert.ok(await screen.findByText('Conteúdo protegido'));
});

test('colaborador numa rota da gestão volta ao painel do colaborador', async () => {
  montar('Colaborador', ['Administrador', 'RH']);
  assert.ok(await screen.findByText('Painel do colaborador'));
  assert.equal(screen.queryByText('Conteúdo protegido'), null);
});

test('gestão numa rota do colaborador volta ao painel da gestão', async () => {
  montar('Administrador', ['Colaborador']);
  assert.ok(await screen.findByText('Painel da gestão'));
});

test('sessão recusada pelo servidor (401) leva ao login', async () => {
  montar('RH', ['RH'], () => ({ status: 401, corpo: { erro: 'Sessão encerrada.' } }));
  assert.ok(await screen.findByText('Tela de login'));
});

test('servidor fora do ar não derruba a sessão: mostra o erro e deixa tentar de novo ou sair', async () => {
  let fora = true;
  const { chamadas } = montar('RH', ['RH'], () => (fora ? { status: 503, corpo: { erro: 'indisponível' } } : { corpo: sessao('RH') }));
  const alerta = await screen.findByRole('alert');
  assert.match(alerta.textContent ?? '', /Não foi possível conectar ao servidor/);
  assert.equal(screen.queryByText('Tela de login'), null);

  fora = false;
  await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }));
  assert.ok(await screen.findByText('Conteúdo protegido'));
  assert.equal(chamadas.filter((chamada) => chamada.caminho === '/auth/sessao').length, 2);
});

test('"Sair e entrar novamente" encerra a sessão e abre o login', async () => {
  const { chamadas } = montar('RH', ['RH'], () => ({ status: 503, corpo: {} }));
  await screen.findByRole('alert');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Sair e entrar novamente' }));
  assert.ok(await screen.findByText('Tela de login'));
  assert.ok(chamadas.some((chamada) => chamada.metodo === 'POST' && chamada.caminho === '/auth/logout'));
});
