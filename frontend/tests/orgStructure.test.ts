import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement, act, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer, type ViteDevServer } from 'vite';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  localStorage: { configurable: true, value: dom.window.localStorage },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
});

let server: ViteDevServer;
let OrgStructure: ComponentType;
let UiProviders: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;

before(async () => {
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true }, appType: 'custom' });
  ({ default: OrgStructure } = await server.ssrLoadModule('/src/pages/Admin/OrgStructure.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

after(async () => {
  await server.close();
  dom.window.close();
});

const departamentos = [
  { id: 1, nome: 'Tecnologia da Informação (TI)', sigla: 'TI', descricao: null, gestor: null, total_colaboradores: 3, colaboradores_ativos: 2, total_cargos: 1 },
  { id: 2, nome: 'Recursos Humanos (RH)', sigla: 'RH', descricao: null, gestor: null, total_colaboradores: 1, colaboradores_ativos: 1, total_cargos: 2 },
];
const cargos = [
  { id: 10, nome: 'Desenvolvedor(a)', departamento_id: 1, departamento_nome: 'Tecnologia da Informação (TI)', departamento_sigla: 'TI', nivel: null, salario_base: '0.00', ocupantes: 2 },
  { id: 20, nome: 'Analista de RH', departamento_id: 2, departamento_nome: 'Recursos Humanos (RH)', departamento_sigla: 'RH', nivel: 'Pleno', salario_base: '4500.00', ocupantes: 1 },
  { id: 21, nome: 'Estagiário(a) de RH', departamento_id: 2, departamento_nome: 'Recursos Humanos (RH)', departamento_sigla: 'RH', nivel: 'Júnior', salario_base: '1800.00', ocupantes: 0 },
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const renderScreen = async (handler: (url: string, method: string) => Response = () => json([])) => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (method === 'GET' && url.endsWith('/estrutura/departamentos')) return json(departamentos);
    if (method === 'GET' && url.endsWith('/estrutura/cargos')) return json(cargos);
    return handler(url, method);
  }) as typeof fetch;
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(UiProviders, null, createElement(OrgStructure))); });
  return { host, root };
};

const cleanup = async ({ host, root }: Awaited<ReturnType<typeof renderScreen>>) => {
  await act(async () => root.unmount());
  host.remove();
};

const clicar = async (elemento: Element | null | undefined) => {
  assert.ok(elemento, 'elemento a clicar não encontrado');
  await act(async () => { (elemento as HTMLElement).click(); });
};

const botaoComTexto = (host: HTMLElement, texto: string | RegExp) =>
  [...host.querySelectorAll('button')].find((b) => (typeof texto === 'string' ? b.textContent?.trim() === texto : texto.test(b.textContent ?? '')));

// A pergunta de confirmação é um diálogo de verdade: o teste responde clicando nos botões dele.
const responderConfirmacao = async (resposta: 'Excluir' | 'Cancelar') => {
  const dialogo = document.querySelector('[role="dialog"]');
  assert.ok(dialogo, 'a confirmação deve abrir um diálogo');
  await clicar([...dialogo.querySelectorAll('button')].find((b) => b.textContent === resposta));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
};

const linhasDaTabela = (host: HTMLElement) => [...host.querySelectorAll('tbody tr')].map((tr) => tr.textContent ?? '');

test('cada departamento mostra o total de colaboradores e os ativos que a API devolveu', async () => {
  const tela = await renderScreen();
  const cards = [...tela.host.querySelectorAll('article')];
  assert.equal(cards.length, 2);
  const [ti, rh] = cards.map((c) => c?.textContent ?? '');
  assert.match(ti, /Tecnologia da Informação \(TI\)/);
  assert.match(ti, /3Total/);
  assert.match(ti, /2Ativos/);
  assert.match(rh, /1Total/);
  assert.match(rh, /1Ativos/);
  await cleanup(tela);
});

test('editar e excluir departamento ficam visíveis sem hover e têm nome acessível', async () => {
  const tela = await renderScreen();
  for (const nome of ['Editar departamento Tecnologia da Informação (TI)', 'Excluir departamento Tecnologia da Informação (TI)']) {
    const botao = tela.host.querySelector(`button[aria-label="${nome}"]`);
    assert.ok(botao, `botão "${nome}" ausente`);
    for (let el: Element | null = botao; el; el = el.parentElement) {
      assert.ok(!/(^|\s)(opacity-0|invisible|hidden)(\s|$)/.test(el.className), `"${nome}" está dentro de um elemento oculto (${el.className})`);
    }
  }
  await cleanup(tela);
});

test('excluir departamento com cargos mostra a mensagem da API e mantém o card', async () => {
  const erro = 'Não é possível excluir um departamento que possui cargos associados.';
  const chamadas: string[] = [];
  const tela = await renderScreen((url, method) => {
    chamadas.push(`${method} ${url}`);
    return json({ erro }, 400);
  });

  await clicar(tela.host.querySelector('button[aria-label="Excluir departamento Tecnologia da Informação (TI)"]'));
  assert.deepEqual(chamadas, [], 'nada é chamado antes da confirmação');
  await responderConfirmacao('Excluir');

  assert.deepEqual(chamadas, ['DELETE /api/estrutura/departamentos/1']);
  assert.equal(document.querySelector('[role="alert"]')?.textContent, erro, 'o erro da API vira um toast de erro');
  assert.equal(tela.host.querySelectorAll('article').length, 2);
  await cleanup(tela);
});

test('excluir departamento sem cargos chama a API e recarrega a lista', async () => {
  const chamadas: string[] = [];
  const tela = await renderScreen((url, method) => {
    chamadas.push(`${method} ${url}`);
    return json({ mensagem: 'Departamento removido com sucesso!' });
  });

  await clicar(tela.host.querySelector('button[aria-label="Excluir departamento Recursos Humanos (RH)"]'));
  await responderConfirmacao('Excluir');

  assert.deepEqual(chamadas, ['DELETE /api/estrutura/departamentos/2']);
  assert.match(document.querySelector('[role="status"]')?.textContent ?? '', /Departamento "Recursos Humanos \(RH\)" excluído\./);
  await cleanup(tela);
});

test('não exclui nada quando o usuário cancela a confirmação', async () => {
  const chamadas: string[] = [];
  const tela = await renderScreen((url, method) => { chamadas.push(`${method} ${url}`); return json({}); });

  await clicar(tela.host.querySelector('button[aria-label="Excluir departamento Recursos Humanos (RH)"]'));
  await responderConfirmacao('Cancelar');
  assert.equal(document.querySelector('[role="dialog"]'), null);

  assert.deepEqual(chamadas, []);
  await cleanup(tela);
});

test('o chip de cada setor lista só os cargos dele e mostra a contagem certa', async () => {
  const tela = await renderScreen();
  await clicar(botaoComTexto(tela.host, /Cargos e Funções/));

  assert.ok(botaoComTexto(tela.host, 'Todos (3)'));
  assert.ok(botaoComTexto(tela.host, 'TI (1)'));
  assert.ok(botaoComTexto(tela.host, 'RH (2)'));
  assert.equal(linhasDaTabela(tela.host).length, 3);

  await clicar(botaoComTexto(tela.host, 'TI (1)'));
  let linhas = linhasDaTabela(tela.host);
  assert.equal(linhas.length, 1);
  assert.match(linhas[0], /Desenvolvedor\(a\)/);

  await clicar(botaoComTexto(tela.host, 'RH (2)'));
  linhas = linhasDaTabela(tela.host);
  assert.equal(linhas.length, 2);
  assert.ok(linhas.every((linha) => /Recursos Humanos/.test(linha)));

  await clicar(botaoComTexto(tela.host, 'Todos (3)'));
  assert.equal(linhasDaTabela(tela.host).length, 3);
  await cleanup(tela);
});

test('a tabela de cargos mostra ocupantes reais e não inventa nível nem salário', async () => {
  const tela = await renderScreen();
  await clicar(botaoComTexto(tela.host, /Cargos e Funções/));
  const [dev, analista] = linhasDaTabela(tela.host);
  const ocupantes = [...tela.host.querySelectorAll('tbody tr')].map((tr) => tr.children[4].textContent?.trim());
  assert.deepEqual(ocupantes, ['2', '1', '0']);

  assert.match(dev, /Não informado/);
  assert.match(dev, /Sem salário base/);
  assert.doesNotMatch(dev, /R\$/);

  assert.match(analista, /Pleno/);
  assert.match(analista, /R\$\s*4\.500,00/);
  await cleanup(tela);
});
