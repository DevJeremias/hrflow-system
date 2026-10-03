// As rotas e a tela de usuários por perfil, com o App real e uma API falsa: quem a matriz de
// permissões (docs/permissoes.md) barra é levado de volta ao início, e quem tem cadastro de funcionário
// alcança a área pessoal em qualquer perfil.
// O DOM global precisa existir antes de o React ser carregado (tests/support/jsdom.ts).
import { dom } from './support/jsdom.ts';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, act, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { novoQueryClient } from './support/consulta.ts';
import { precarregarTelas } from './support/rotas.ts';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer;
let Harness: ComponentType<{ initialPath: string }>;
const originalFetch = globalThis.fetch;
const originalConfirm = (globalThis as { confirm?: unknown }).confirm;

const EMPRESA = 'Empresa Ficticia Alfa Ltda';
const sessoes = {
  admin: { id: 1, nome: 'Admin Ficticio', perfil: 'Administrador', empresa_nome: EMPRESA, funcionario_id: null, avatar: null },
  rita: { id: 3, nome: 'Rita RH Ficticia', perfil: 'RH', empresa_nome: EMPRESA, funcionario_id: 1, avatar: null },
  rhSemCadastro: { id: 8, nome: 'RH Sem Cadastro', perfil: 'RH', empresa_nome: EMPRESA, funcionario_id: null, avatar: null },
  caio: { id: 4, nome: 'Caio Colaborador Ficticio', perfil: 'Colaborador', empresa_nome: EMPRESA, funcionario_id: 2, avatar: null },
};

const json = (corpo: unknown, status = 200, cabecalhos: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: cabecalhos });

before(async () => {
  document.cookie = 'hrflow_csrf=token-ficticio; Path=/';
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  await precarregarTelas(server);
  const [{ default: App }, { AuthProvider }, { default: UiProviders }] = await Promise.all([
    server.ssrLoadModule('/src/App.tsx'),
    server.ssrLoadModule('/src/contexts/AuthContext.tsx'),
    server.ssrLoadModule('/src/components/ui/UiProviders.tsx'),
  ]);
  Harness = ({ initialPath }) => createElement(QueryClientProvider, { client: novoQueryClient() },
    createElement(MemoryRouter, { initialEntries: [initialPath] },
      createElement(AuthProvider, null, createElement(UiProviders, null, createElement(App)))));
});

after(async () => {
  globalThis.fetch = originalFetch;
  (globalThis as { confirm?: unknown }).confirm = originalConfirm;
  await server.close();
  dom.window.close();
});

beforeEach(() => { globalThis.fetch = originalFetch; });

interface Chamada {
  metodo: string;
  url: string;
  corpo: unknown;
}

// API falsa: a sessão do perfil, a lista de usuários e respostas vazias para o resto (as telas
// pessoais e de gestão carregam listas que aqui não interessam).
const apiFalsa = (sessao: unknown, chamadas: Chamada[] = [], usuarios: unknown[] = []) => (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const metodo = init?.method ?? 'GET';
  chamadas.push({ metodo, url, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
  if (url.endsWith('/api/auth/sessao')) return json(sessao);
  if (url.includes('/api/usuarios') && metodo === 'GET') return json(usuarios, 200, { 'X-Total-Count': String(usuarios.length) });
  if (url.includes('/api/usuarios') && metodo === 'POST') {
    return json({
      usuario: { id: 20, nome: 'Maria Souza', email: 'maria@exemplo.invalid', perfil: 'RH', funcionario_id: null, funcionario_status: null, senha_provisoria: 1 },
      senha_provisoria: 'Ab3dEf7hJk9m',
    }, 201);
  }
  if (url.includes('/api/dashboard/resumo')) return json({ colaboradoresAtivos: 3, colaboradoresInativos: 0, departamentos: 4, cargos: 4, marcacoesHoje: 0 });
  if (url.includes('/api/funcionarios')) return json([], 200, { 'X-Total-Count': '0' });
  return json([]);
}) as typeof fetch;

const abrir = async (caminho: string) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(Harness, { initialPath: caminho })); });
  // Deixa as telas (carregadas sob demanda) e as requisições terminarem.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
  return { host, fechar: async () => { await act(async () => root.unmount()); host.remove(); } };
};

const titulo = (host: HTMLElement) => host.querySelector('h1')?.textContent ?? '';
const itensDoMenu = (host: HTMLElement) => [...host.querySelectorAll('nav a')].map((link) => link.textContent);

test('o RH que tenta abrir Usuários ou Depto & Cargos volta ao dashboard', async () => {
  for (const caminho of ['/admin/usuarios', '/admin/estrutura']) {
    globalThis.fetch = apiFalsa(sessoes.rita);
    const { host, fechar } = await abrir(caminho);
    assert.equal(titulo(host), 'Dashboard', caminho);
    await fechar();
  }
});

test('o RH com cadastro abre Meu ponto e Meu holerite; o menu mostra a área dele', async () => {
  for (const [caminho, tela] of [['/meu-painel', /Olá, Rita/], ['/meu-painel/holerites', /Meus Holerites/]] as const) {
    globalThis.fetch = apiFalsa(sessoes.rita);
    const { host, fechar } = await abrir(caminho);
    assert.match(titulo(host), tela, caminho);
    assert.deepEqual(itensDoMenu(host), ['Dashboard', 'Colaboradores', 'Folha de Pagamento', 'Empresa', 'Gestão de Ponto', 'Relatórios', 'Meu ponto', 'Meu holerite', 'Meu Perfil']);
    await fechar();
  }
});

test('o RH sem cadastro não tem área pessoal e volta ao dashboard', async () => {
  globalThis.fetch = apiFalsa(sessoes.rhSemCadastro);
  const { host, fechar } = await abrir('/meu-painel');
  assert.equal(titulo(host), 'Dashboard');
  assert.equal(itensDoMenu(host).includes('Meu ponto'), false);
  await fechar();
});

test('o Colaborador vê só a própria área e não entra na gestão', async () => {
  globalThis.fetch = apiFalsa(sessoes.caio);
  const { host, fechar } = await abrir('/admin/usuarios');
  assert.match(titulo(host), /Olá, Caio/);
  assert.deepEqual(itensDoMenu(host), ['Meu ponto', 'Meu holerite', 'Meus Dados']);
  await fechar();
});

test('no dashboard do RH, departamentos e cargos não levam à tela que ele não alcança', async () => {
  globalThis.fetch = apiFalsa(sessoes.rita);
  const { host, fechar } = await abrir('/admin');
  const links = [...host.querySelectorAll('main a')].map((link) => link.textContent ?? '');
  assert.equal(links.some((texto) => texto.includes('Departamentos')), false);
  assert.equal(links.some((texto) => texto.includes('Cargos')), false);
  assert.ok(links.some((texto) => texto.includes('Colaboradores')));
  assert.match(host.textContent ?? '', /Departamentos/);
  await fechar();
});

test('o Administrador vê Usuários e Depto & Cargos no menu', async () => {
  globalThis.fetch = apiFalsa(sessoes.admin);
  const { host, fechar } = await abrir('/admin');
  assert.deepEqual(itensDoMenu(host), ['Dashboard', 'Colaboradores', 'Depto & Cargos', 'Folha de Pagamento', 'Empresa', 'Gestão de Ponto', 'Relatórios', 'Usuários', 'Meu Perfil']);
  await fechar();
});

test('o Administrador cria um RH e recebe a senha provisória uma única vez', async () => {
  const chamadas: Chamada[] = [];
  const existente = { id: 1, nome: 'Admin Ficticio', email: 'admin@exemplo.invalid', perfil: 'Administrador', funcionario_id: null, funcionario_status: null, senha_provisoria: 0 };
  globalThis.fetch = apiFalsa(sessoes.admin, chamadas, [existente]);
  const { host, fechar } = await abrir('/admin/usuarios');
  assert.equal(titulo(host), 'Usuários');
  assert.match(host.textContent ?? '', /admin@exemplo\.invalid/);
  // A própria conta não tem seletor de perfil nem "Redefinir senha".
  assert.equal(host.querySelector('select'), null);
  assert.equal([...host.querySelectorAll('button')].some((b) => b.textContent?.includes('Redefinir senha')), false);

  await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Novo usuário'))?.click(); });
  const preencher = async (id: string, valor: string) => {
    const campo = document.querySelector<HTMLInputElement>(`[name="${id}"]`);
    assert.ok(campo, id);
    const definir = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      definir?.call(campo, valor);
      campo.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  };
  await preencher('nome', 'Maria Souza');
  await preencher('email', 'maria@exemplo.invalid');
  await act(async () => { document.querySelector('[role="dialog"] form')?.requestSubmit(); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });

  const criacao = chamadas.find((chamada) => chamada.metodo === 'POST');
  assert.deepEqual(criacao?.corpo, { nome: 'Maria Souza', email: 'maria@exemplo.invalid', perfil: 'RH' });
  assert.equal(host.querySelector('[data-testid="senha-provisoria"]')?.textContent, 'Ab3dEf7hJk9m');
  assert.match(host.textContent ?? '', /não aparece de novo/);

  await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Já entreguei'))?.click(); });
  assert.equal(host.querySelector('[data-testid="senha-provisoria"]'), null);
  await fechar();
});

test('o erro da API ao criar o usuário aparece no modal e o que foi digitado fica', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/api/usuarios') && init?.method === 'POST') return json({ erro: 'Este e-mail já está registado no sistema.' }, 409);
    return apiFalsa(sessoes.admin)(input, init);
  }) as typeof fetch;
  const { host, fechar } = await abrir('/admin/usuarios');
  await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Novo usuário'))?.click(); });
  const definir = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set;
  for (const [id, valor] of [['nome', 'Maria'], ['email', 'maria@exemplo.invalid']]) {
    const campo = document.querySelector<HTMLInputElement>(`[name="${id}"]`);
    await act(async () => { definir?.call(campo, valor); campo?.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  }
  await act(async () => { document.querySelector('[role="dialog"] form')?.requestSubmit(); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
  assert.match(document.querySelector('[role="dialog"] [role="alert"]')?.textContent ?? '', /já está registado/);
  assert.equal(document.querySelector<HTMLInputElement>('[name="email"]')?.value, 'maria@exemplo.invalid');
  await fechar();
});
