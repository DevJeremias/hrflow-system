// O AuthContext: de onde vem a identidade, o que acontece no login, na saída e quando o servidor recusa
// ou não responde. O AuthProvider é o de verdade; a API é simulada e a rota atual aparece na tela.
import { dom, abrirVite, limparTela, simularApi } from './support/componentes.ts';
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState, type ComponentType, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ViteDevServer } from 'vite';

let server: ViteDevServer;
let AuthProvider: ComponentType<{ children: ReactNode }>;
let useAuth: () => ReturnType<typeof import('../src/contexts/AuthContext.tsx').useAuth>;
let restaurarApi: () => void;

before(async () => {
  server = await abrirVite();
  ({ AuthProvider, useAuth } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
});

after(async () => {
  await server.close();
  dom.window.close();
});

afterEach(() => {
  limparTela();
  restaurarApi?.();
});

const sessao = (perfil: string, extra: Record<string, unknown> = {}) =>
  ({ id: 3, nome: 'Pessoa Ficticia', perfil, funcionario_id: perfil === 'Colaborador' ? 5 : null, empresa_nome: 'Empresa Ficticia', ...extra });

// Mostra o estado do contexto em texto e expõe as ações em botões, como uma tela as usaria.
const Painel = () => {
  const auth = useAuth();
  const location = useLocation();
  const [erro, setErro] = useState('');
  return createElement('div', null,
    createElement('p', { 'data-testid': 'estado' }, JSON.stringify({
      loading: auth.loading, autenticado: auth.isAuthenticated, usuario: auth.user?.nome ?? null, perfil: auth.user?.role ?? null,
      erroDeSessao: auth.sessionError, aviso: auth.sessionNotice, rota: location.pathname,
    })),
    createElement('p', { role: 'status' }, erro),
    createElement('button', { onClick: () => auth.login('rita@exemplo.invalid', 'senha-ficticia').catch((e: Error) => setErro(e.message)) }, 'entrar'),
    createElement('button', { onClick: () => auth.logout('Até logo.') }, 'sair'),
    createElement('button', { onClick: () => auth.retrySession() }, 'tentar de novo'),
    createElement('button', { onClick: () => auth.updateUser({ nome: 'Nome Novo' }) }, 'renomear'),
  );
};

const estado = () => JSON.parse(screen.getByTestId('estado').textContent ?? '{}');

const montar = (rotear: Parameters<typeof simularApi>[0], { comCookie = true }: { comCookie?: boolean } = {}) => {
  if (comCookie) dom.window.document.cookie = 'hrflow_csrf=token-ficticio; path=/';
  const api = simularApi(rotear);
  restaurarApi = api.restaurar;
  render(createElement(MemoryRouter, { initialEntries: ['/inicio'] },
    createElement(QueryClientProvider, { client: new QueryClient() }, createElement(AuthProvider, null, createElement(Painel)))));
  return api;
};

test('sem cookie de sessão não há o que confirmar: nada de chamada à API e nada de carregamento', async () => {
  const { chamadas } = montar(() => ({ status: 500 }), { comCookie: false });
  assert.deepEqual(estado(), { loading: false, autenticado: false, usuario: null, perfil: null, erroDeSessao: null, aviso: null, rota: '/inicio' });
  assert.deepEqual(chamadas, []);
});

test('com o cookie, a identidade vem de GET /auth/sessao', async () => {
  montar(() => ({ corpo: sessao('RH') }));
  await waitFor(() => assert.equal(estado().usuario, 'Pessoa Ficticia'));
  assert.equal(estado().perfil, 'RH');
  assert.equal(estado().autenticado, true);
  assert.equal(estado().loading, false);
});

test('resposta de sessão inválida não vira identidade', async () => {
  montar(() => ({ corpo: sessao('Perfil Inventado') }));
  await waitFor(() => assert.match(estado().erroDeSessao, /sessão inválida/));
  assert.equal(estado().autenticado, false);
});

test('401 ao confirmar a sessão encerra e avisa que ela expirou', async () => {
  montar(() => ({ status: 401, corpo: { erro: 'Sessão encerrada.' } }));
  await waitFor(() => assert.match(estado().aviso, /sessão expirou/));
  assert.equal(estado().autenticado, false);
  assert.equal(estado().erroDeSessao, null);
});

test('rede fora é erro de sessão, não saída: tentar de novo recupera a identidade', async () => {
  let fora = true;
  montar(() => (fora ? { status: 503, corpo: {} } : { corpo: sessao('Colaborador') }));
  await waitFor(() => assert.match(estado().erroDeSessao, /Não foi possível conectar/));
  assert.equal(estado().autenticado, false);
  assert.equal(estado().aviso, null);

  fora = false;
  await userEvent.setup().click(screen.getByRole('button', { name: 'tentar de novo' }));
  await waitFor(() => assert.equal(estado().usuario, 'Pessoa Ficticia'));
  assert.equal(estado().erroDeSessao, null);
});

test('login da gestão confirma a sessão e leva ao painel da gestão', async () => {
  const { chamadas } = montar(({ caminho, metodo }) => {
    if (metodo === 'POST' && caminho === '/auth/login') return { corpo: { nome: 'Rita', perfil: 'RH' } };
    if (caminho === '/auth/sessao') return { corpo: sessao('RH') };
    return { status: 404 };
  }, { comCookie: false });

  await userEvent.setup().click(screen.getByRole('button', { name: 'entrar' }));
  await waitFor(() => assert.equal(estado().rota, '/admin'));
  assert.equal(estado().perfil, 'RH');
  assert.deepEqual(chamadas.map((c) => `${c.metodo} ${c.caminho}`), ['POST /auth/login', 'GET /auth/sessao']);
  assert.deepEqual(chamadas[0].corpo, { email: 'rita@exemplo.invalid', senha: 'senha-ficticia' });
});

test('login de colaborador leva ao painel do colaborador', async () => {
  montar(({ caminho, metodo }) => {
    if (metodo === 'POST') return { corpo: {} };
    if (caminho === '/auth/sessao') return { corpo: sessao('Colaborador') };
    return { status: 404 };
  }, { comCookie: false });

  await userEvent.setup().click(screen.getByRole('button', { name: 'entrar' }));
  await waitFor(() => assert.equal(estado().rota, '/meu-painel'));
});

test('login com senha provisória leva à troca de senha, não ao painel', async () => {
  montar(({ caminho, metodo }) => {
    if (metodo === 'POST') return { corpo: {} };
    if (caminho === '/auth/sessao') return { corpo: sessao('Colaborador', { senha_provisoria: true }) };
    return { status: 404 };
  }, { comCookie: false });

  await userEvent.setup().click(screen.getByRole('button', { name: 'entrar' }));
  await waitFor(() => assert.equal(estado().rota, '/trocar-senha'));
  assert.equal(estado().perfil, 'Colaborador');
});

test('login recusado mostra a mensagem do servidor e não autentica', async () => {
  montar(({ metodo }) => (metodo === 'POST'
    ? { status: 401, corpo: { erro: 'E-mail ou senha incorretos.' } }
    : { status: 404 }), { comCookie: false });

  await userEvent.setup().click(screen.getByRole('button', { name: 'entrar' }));
  await waitFor(() => assert.equal(screen.getByRole('status').textContent, 'E-mail ou senha incorretos.'));
  assert.equal(estado().autenticado, false);
  assert.equal(estado().rota, '/inicio');
});

test('login que não consegue confirmar a sessão desfaz tudo em vez de ficar meio entrado', async () => {
  montar(({ metodo }) => {
    if (metodo === 'POST') return { corpo: {} };
    return { status: 503, corpo: {} };
  }, { comCookie: false });

  await userEvent.setup().click(screen.getByRole('button', { name: 'entrar' }));
  await waitFor(() => assert.match(screen.getByRole('status').textContent ?? '', /Não foi possível conectar/));
  assert.equal(estado().autenticado, false);
  assert.equal(estado().rota, '/inicio');
});

test('sair chama o servidor, limpa a identidade, mostra o aviso no login e leva a /login', async () => {
  const { chamadas } = montar(({ caminho, metodo }) => {
    if (metodo === 'POST' && caminho === '/auth/logout') return { status: 204 };
    return { corpo: sessao('RH') };
  });
  await waitFor(() => assert.equal(estado().autenticado, true));

  await userEvent.setup().click(screen.getByRole('button', { name: 'sair' }));
  await waitFor(() => assert.equal(estado().rota, '/login'));
  assert.equal(estado().autenticado, false);
  assert.equal(estado().aviso, 'Até logo.');
  assert.ok(chamadas.some((c) => c.metodo === 'POST' && c.caminho === '/auth/logout'));
  assert.equal(dom.window.document.cookie.includes('hrflow_csrf=token'), false, 'o cookie de CSRF cai com a sessão');
});

test('sair sem resposta do servidor sai mesmo assim', async () => {
  montar(({ metodo }) => {
    if (metodo === 'POST') throw new TypeError('Failed to fetch');
    return { corpo: sessao('RH') };
  });
  await waitFor(() => assert.equal(estado().autenticado, true));

  await userEvent.setup().click(screen.getByRole('button', { name: 'sair' }));
  await waitFor(() => assert.equal(estado().rota, '/login'));
  assert.equal(estado().autenticado, false);
});

test('updateUser troca só os campos informados', async () => {
  montar(() => ({ corpo: sessao('RH') }));
  await waitFor(() => assert.equal(estado().autenticado, true));

  await userEvent.setup().click(screen.getByRole('button', { name: 'renomear' }));
  await waitFor(() => assert.equal(estado().usuario, 'Nome Novo'));
  assert.equal(estado().perfil, 'RH');
});

test('apaga do navegador as chaves de versões antigas que guardavam o token e a identidade', async () => {
  for (const chave of ['token', 'user', 'nomeUsuario', 'funcionarioId', 'perfil']) dom.window.localStorage.setItem(chave, 'x');
  dom.window.localStorage.setItem('preferencia', 'fica');
  montar(() => ({ status: 500 }), { comCookie: false });
  await waitFor(() => assert.equal(dom.window.localStorage.getItem('token'), null));
  for (const chave of ['user', 'nomeUsuario', 'funcionarioId', 'perfil']) assert.equal(dom.window.localStorage.getItem(chave), null);
  assert.equal(dom.window.localStorage.getItem('preferencia'), 'fica');
});

test('useAuth fora do AuthProvider lança erro claro', async () => {
  const Sozinho = () => { useAuth(); return null; };
  const silenciar = console.error;
  console.error = () => {};
  try {
    assert.throws(() => render(createElement(Sozinho)), /useAuth deve ser usado dentro de um AuthProvider/);
  } finally {
    console.error = silenciar;
  }
  restaurarApi = () => {};
});
