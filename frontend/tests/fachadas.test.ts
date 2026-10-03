import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { createElement, act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { novoQueryClient } from './support/consulta.ts';
import { precarregarTelas } from './support/rotas.ts';
import { createServer } from 'vite';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  localStorage: { configurable: true, value: dom.window.localStorage },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
});

type Modulos = {
  App: typeof import('../src/App.tsx').default;
  AuthProvider: typeof import('../src/contexts/AuthContext.tsx').AuthProvider;
  solicitacoesAtivas: typeof import('../src/utils/recursos.ts').solicitacoesAtivas;
};

const abrirServidor = async (flag: string | undefined) => {
  if (flag === undefined) delete process.env.VITE_FEATURE_SOLICITACOES;
  else process.env.VITE_FEATURE_SOLICITACOES = flag;
  const server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  await precarregarTelas(server);
  const modulos: Modulos = {
    App: (await server.ssrLoadModule('/src/App.tsx')).default,
    AuthProvider: (await server.ssrLoadModule('/src/contexts/AuthContext.tsx')).AuthProvider,
    solicitacoesAtivas: (await server.ssrLoadModule('/src/utils/recursos.ts')).solicitacoesAtivas,
  };
  return { server, ...modulos };
};

let desligada: Awaited<ReturnType<typeof abrirServidor>>;
let ligada: Awaited<ReturnType<typeof abrirServidor>>;
const originalFetch = globalThis.fetch;
let chamadas: string[] = [];

before(async () => {
  desligada = await abrirServidor(undefined);
  ligada = await abrirServidor('true');
});

after(async () => {
  globalThis.fetch = originalFetch;
  await Promise.all([desligada.server.close(), ligada.server.close()]);
  dom.window.close();
});

const holerite = {
  id: '7', name: 'Ana Souza', role: 'Dev', department: 'Eng', baseSalary: 5000, totalEarnings: 0, totalDeductions: 400,
  totalGross: 5000, netSalary: 4600, employerCharges: 1390, earningsList: [], deductionsList: [],
};

const json = (corpo: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json', ...headers } });

const instalarApi = (perfil: 'Administrador' | 'Colaborador') => {
  chamadas = [];
  document.cookie = 'hrflow_csrf=teste';
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const caminho = new URL(String(entrada), 'http://localhost').pathname;
    chamadas.push(caminho);
    switch (caminho) {
      case '/api/auth/sessao': return json({ id: 1, nome: 'Rita Teste', perfil, empresa_nome: 'Empresa Ficticia Alfa Ltda', funcionario_id: perfil === 'Colaborador' ? 7 : null });
      case '/api/folha/processar': return json([holerite], { 'X-Total-Count': '1' });
      case '/api/folha/meu-holerite': return json([holerite]);
      case '/api/funcionarios': return json([{ id: 7, nome: 'Ana Souza', email: 'ana@exemplo.invalid', cargo_nome: 'Dev', departamento_nome: 'Eng', status: 'Ativo' }], { 'X-Total-Count': '1' });
      case '/api/estrutura/departamentos': return json([{ id: 1, nome: 'Eng', sigla: 'ENG', descricao: '', gestor: '' }]);
      case '/api/estrutura/cargos': return json([{ id: 1, nome: 'Dev', departamento_nome: 'Eng', nivel: 'Pleno', salario_base: '5000' }]);
      case '/api/perfil/meus-dados': return json({ perfil, vinculado: perfil === 'Colaborador', nome: 'Rita Teste', email: 'rita@exemplo.invalid', avatar: null, telefone: null, cpf: null, data_nascimento: null, data_admissao: null, endereco: null, tipo_contrato: null, nivel: null, banco: null, agencia: null, conta: null, tipo_conta: null, cargo: null, departamento: null });
      default: return json([]);
    }
  }) as typeof fetch;
};

const Localizacao = () => {
  const { pathname } = useLocation();
  return createElement('output', { 'data-rota': pathname });
};

const abrirApp = async (modulos: Awaited<ReturnType<typeof abrirServidor>>, rota: string) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const cliente = novoQueryClient();
  const arvore: ReactElement = createElement(QueryClientProvider, { client: cliente },
    createElement(MemoryRouter, { initialEntries: [rota] },
      createElement(modulos.AuthProvider, null, createElement(modulos.App), createElement(Localizacao))));
  await act(async () => { root.render(arvore); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 700)); });
  return { host, root, rota: () => host.querySelector('output')?.getAttribute('data-rota') };
};

const fechar = async ({ host, root }: { host: HTMLElement; root: { unmount: () => void } }) => {
  await act(async () => root.unmount());
  host.remove();
};

const propsReact = (el: Element): Record<string, unknown> => {
  const chave = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  return chave ? (el as unknown as Record<string, Record<string, unknown>>)[chave] : {};
};

const botoesMudos = (host: HTMLElement) => [...host.querySelectorAll('button')]
  .filter((b) => {
    const props = propsReact(b);
    return !props.onClick && props.type !== 'submit' && !props.disabled;
  })
  .map((b) => (b.textContent || b.getAttribute('title') || b.outerHTML).trim());

const clicarTexto = async (host: HTMLElement, texto: RegExp) => {
  const botao = [...host.querySelectorAll('button')].find((b) => texto.test(b.textContent ?? ''));
  assert.ok(botao, `botão ${texto} não encontrado`);
  await act(async () => { botao.click(); });
};

const arquivos = (pasta: string): string[] => readdirSync(pasta, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? arquivos(join(pasta, e.name)) : [join(pasta, e.name)]));

test('a interface não promete o que ainda não existe', () => {
  const proibidos = /próxima fase|no futuro|Buscar no sistema/;
  const achados = arquivos('src').filter((f) => /\.(tsx?|jsx?)$/.test(f) && proibidos.test(readFileSync(f, 'utf8')));
  assert.deepEqual(achados, []);
});

test('a flag de solicitações só liga com o texto "true"', async () => {
  assert.equal(desligada.solicitacoesAtivas(), false);
  assert.equal(ligada.solicitacoesAtivas(), true);
  const { recursoLigado } = await desligada.server.ssrLoadModule('/src/utils/recursos.ts');
  for (const valor of [undefined, '', 'false', '1', 'TRUE']) assert.equal(recursoLigado(valor), false);
});

test('com a flag desligada /meu-painel/solicitacoes volta ao painel, sem menu nem chamada à API', async () => {
  instalarApi('Colaborador');
  const app = await abrirApp(desligada, '/meu-painel/solicitacoes');
  assert.equal(app.rota(), '/meu-painel');
  assert.doesNotMatch(app.host.textContent ?? '', /Solicitações/);
  assert.deepEqual(chamadas.filter((c) => c.includes('solicitacoes')), []);
  await fechar(app);
});

test('com a flag ligada a rota e o menu de solicitações existem', async () => {
  instalarApi('Colaborador');
  const app = await abrirApp(ligada, '/meu-painel/solicitacoes');
  assert.equal(app.rota(), '/meu-painel/solicitacoes');
  assert.match(app.host.textContent ?? '', /Minhas Solicitações/);
  await fechar(app);
});

test('o serviço de solicitações falha de forma explícita em vez de fingir sucesso', async () => {
  const { requestService } = await desligada.server.ssrLoadModule('/src/services/requestService.ts');
  await assert.rejects(() => requestService.createRequest({}), /não estão disponíveis/);
  await assert.rejects(() => requestService.getAllRequests(), /não estão disponíveis/);
});

test('o cabeçalho não tem busca nem sino decorativos', async () => {
  instalarApi('Administrador');
  const app = await abrirApp(desligada, '/admin');
  assert.ok(!app.host.querySelector('header input'), 'o cabeçalho não deve ter campo de busca');
  assert.ok(!app.host.querySelector('header svg.lucide-bell'), 'o cabeçalho não deve ter sino');
  assert.deepEqual(botoesMudos(app.host), []);
  await fechar(app);
});

const telasAdmin: Array<{ rota: string; titulo: RegExp; abrir?: RegExp[] }> = [
  { rota: '/admin', titulo: /Dashboard/ },
  { rota: '/admin/colaboradores', titulo: /Ana Souza/, abrir: [/Adicionar Colaborador/] },
  { rota: '/admin/estrutura', titulo: /Eng/, abrir: [/Criar Departamento/] },
  { rota: '/admin/estrutura', titulo: /Eng/, abrir: [/Cargos e Funções/, /Criar Cargo/] },
  { rota: '/admin/folha', titulo: /Ana Souza/ },
  { rota: '/admin/gestao-ponto', titulo: /Ponto/ },
  { rota: '/admin/perfil', titulo: /Rita Teste/ },
];

for (const tela of telasAdmin) {
  test(`${tela.rota}${tela.abrir ? ` (abrindo ${tela.abrir.join(' > ')})` : ''}: todo botão visível faz algo`, async () => {
    instalarApi('Administrador');
    const app = await abrirApp(desligada, tela.rota);
    assert.equal(app.rota(), tela.rota);
    assert.match(app.host.textContent ?? '', tela.titulo);
    assert.deepEqual(botoesMudos(app.host), []);
    for (const texto of tela.abrir ?? []) {
      await clicarTexto(app.host, texto);
      assert.deepEqual(botoesMudos(app.host), [], `depois de abrir ${texto}`);
    }
    await fechar(app);
  });
}

test('a folha não oferece fechar mês, lançamento avulso nem escolha de competência', async () => {
  instalarApi('Administrador');
  const app = await abrirApp(desligada, '/admin/folha');
  const texto = app.host.textContent ?? '';
  assert.doesNotMatch(texto, /Fechar Mês/);
  assert.ok(!app.host.querySelector('input[type="month"]'), 'não deve haver seletor de competência');
  assert.ok(!app.host.querySelector('[title="Adicionar Lançamento Avulso"]'), 'não deve haver lançamento avulso');
  assert.doesNotMatch(texto, /Abril de 2026/);
  await fechar(app);
});

test('o modal de cargo não oferece proventos e descontos padrão', async () => {
  instalarApi('Administrador');
  const app = await abrirApp(desligada, '/admin/estrutura');
  await clicarTexto(app.host, /Cargos e Funções/);
  await clicarTexto(app.host, /Criar Cargo/);
  const texto = app.host.textContent ?? '';
  assert.match(texto, /Título do Cargo/);
  assert.doesNotMatch(texto, /Proventos Padrão|Descontos Padrão/);
  await fechar(app);
});

test('o holerite do colaborador diz que o demonstrativo usa os dados atuais', async () => {
  instalarApi('Colaborador');
  const app = await abrirApp(desligada, '/meu-painel/holerites');
  const texto = app.host.textContent ?? '';
  assert.match(texto, /Demonstrativo calculado com os dados atuais/);
  assert.doesNotMatch(texto, /Histórico/);
  await fechar(app);
});

test('nenhuma rota do app consulta endpoint inexistente', async () => {
  const rotas = [['Administrador', ['/admin', '/admin/colaboradores', '/admin/estrutura', '/admin/folha', '/admin/gestao-ponto', '/admin/perfil']],
    ['Colaborador', ['/meu-painel', '/meu-painel/holerites', '/meu-painel/solicitacoes', '/meu-painel/perfil']]] as const;
  for (const [perfil, lista] of rotas) {
    for (const rota of lista) {
      instalarApi(perfil);
      const app = await abrirApp(desligada, rota);
      assert.deepEqual(chamadas.filter((c) => c.startsWith('/api/solicitacoes')), [], rota);
      await fechar(app);
    }
  }
});
