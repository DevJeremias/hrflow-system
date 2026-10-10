import { after, afterEach, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement, act, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { novoQueryClient } from './support/consulta.ts';
import { mesAtualNoFuso, mesesAntes } from '../src/utils/competencia.ts';
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
let Harness: ComponentType<{ initialPath: string }>;
let cliente = novoQueryClient();
const originalFetch = globalThis.fetch;

// Fixtures da Alfa: 3 colaboradores ativos, 4 departamentos e 4 cargos.
const resumoDaAlfa = { colaboradoresAtivos: 3, colaboradoresInativos: 1, departamentos: 4, cargos: 4, marcacoesHoje: 2 };
const sessaoDoAdmin = { id: 1, nome: 'Admin Ficticio', perfil: 'Administrador', empresa_nome: 'Empresa Ficticia Alfa Ltda', funcionario_id: null, avatar: null };

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

// Doze meses de headcount terminando no mês corrente: o quadro cresce, com um desligamento e duas admissões no último mês.
const MES = mesAtualNoFuso();
const headcountDaAlfa = Array.from({ length: 12 }, (_, i) => ({
  mes: mesesAntes(MES, 11 - i), admitidos: i === 11 ? 2 : 0, desligados: i === 11 ? 1 : 0, ativos: 20 + i, turnover: i === 11 ? 4.4 : 0,
}));
const aniversariantesDaAlfa = Array.from({ length: 8 }, (_, i) => ({ funcionarioId: i + 1, nome: `Aniversariante ${i + 1}`, departamento: 'Tecnologia', cargo: null, dia: i + 1 }));

before(async () => {
  // O cookie de CSRF é o que diz ao AuthProvider que há uma sessão a confirmar.
  document.cookie = 'hrflow_csrf=token-ficticio; Path=/';
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true, ws: false }, appType: 'custom' });
  const [{ default: Dashboard }, { AuthProvider }] = await Promise.all([
    server.ssrLoadModule('/src/pages/Admin/Dashboard.tsx'),
    server.ssrLoadModule('/src/contexts/AuthContext.tsx'),
  ]);
  const page = (path: string, element: unknown) => createElement(Route, { path, element: element as never });
  Harness = ({ initialPath }) => createElement(QueryClientProvider, { client: cliente },
    createElement(MemoryRouter, { initialEntries: [initialPath] },
      createElement(AuthProvider, null,
        createElement(Routes, null,
          page('/admin', createElement(Dashboard)),
          page('/admin/colaboradores', createElement('p', null, 'Tela de colaboradores')),
          page('/admin/estrutura', createElement('p', null, 'Tela de estrutura')),
          page('/admin/gestao-ponto', createElement('p', null, 'Tela de ponto'))))));
});

after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
  dom.window.close();
});

// Toda árvore montada é desmontada ao fim do teste, passe ele ou falhe: uma árvore que sobra, com o fetch já
// restaurado, fica tentando a rede de verdade e o processo do teste não termina.
const montados: { host: HTMLElement; root: ReturnType<typeof createRoot> }[] = [];

beforeEach(() => { globalThis.fetch = originalFetch; cliente = novoQueryClient(); chamadas = []; });

const desmontarTudo = async () => {
  for (const { host, root } of montados.splice(0)) {
    await act(async () => root.unmount());
    host.remove();
  }
};

afterEach(desmontarTudo);

const renderDashboard = async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  montados.push({ host, root });
  await act(async () => { root.render(createElement(Harness, { initialPath: '/admin' })); });
  return { host };
};

let chamadas: string[] = [];

const apiFalsa = (
  resumo: () => Response | Promise<Response>,
  relatorios: { headcount?: () => Response; aniversariantes?: () => Response } = {},
) => (async (input: RequestInfo | URL) => {
  const url = String(input);
  chamadas.push(url);
  if (url.endsWith('/api/auth/sessao')) return json(sessaoDoAdmin);
  if (url.endsWith('/api/dashboard/resumo')) return resumo();
  if (url.includes('/api/relatorios/headcount')) return (relatorios.headcount ?? (() => json(headcountDaAlfa)))();
  if (url.includes('/api/relatorios/aniversariantes')) return (relatorios.aniversariantes ?? (() => json(aniversariantesDaAlfa)))();
  throw new Error(`chamada inesperada: ${url}`);
}) as typeof fetch;

const cartao = (host: HTMLElement, rotulo: string) =>
  [...host.querySelectorAll('a')].find((link) => link.textContent?.includes(rotulo));

test('mostra as contagens reais da API, sem espera artificial', async () => {
  globalThis.fetch = apiFalsa(() => json(resumoDaAlfa));
  const { host } = await renderDashboard();
  assert.match(cartao(host, 'Colaboradores')?.textContent ?? '', /^Colaboradores31 inativo$/);
  assert.match(cartao(host, 'Departamentos')?.textContent ?? '', /^Departamentos4$/);
  assert.match(cartao(host, 'Cargos')?.textContent ?? '', /^Cargos Cadastrados4$/);
  assert.match(cartao(host, 'Marcações Hoje')?.textContent ?? '', /^Marcações Hoje2$/);
  assert.doesNotMatch(host.textContent ?? '', /Aprovações Pendentes/);
});

test('cada cartão leva à tela correspondente', async () => {
  const destinos: Array<[string, string]> = [
    ['Colaboradores', 'Tela de colaboradores'],
    ['Departamentos', 'Tela de estrutura'],
    ['Cargos', 'Tela de estrutura'],
    ['Marcações Hoje', 'Tela de ponto'],
  ];
  for (const [rotulo, tela] of destinos) {
    globalThis.fetch = apiFalsa(() => json(resumoDaAlfa));
    const { host } = await renderDashboard();
    const link = cartao(host, rotulo);
    assert.ok(link, `o cartão ${rotulo} deve ser um link`);
    await act(async () => { link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
    assert.match(host.textContent ?? '', new RegExp(tela));
    await desmontarTudo();
  }
});

test('erro de rede mostra o alerta com "Tentar novamente" em vez de zeros, e tentar de novo carrega os dados', async () => {
  globalThis.fetch = apiFalsa(() => { throw new TypeError('Failed to fetch'); });
  const { host } = await renderDashboard();
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /Não foi possível conectar ao servidor/);
  assert.equal(cartao(host, 'Colaboradores'), undefined);
  const retry = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Tentar novamente');
  assert.ok(retry, 'o alerta deve oferecer nova tentativa');

  globalThis.fetch = apiFalsa(() => json(resumoDaAlfa));
  await act(async () => { retry.click(); });
  assert.equal(host.querySelector('[role="alert"]'), null);
  assert.match(cartao(host, 'Colaboradores')?.textContent ?? '', /^Colaboradores3/);
});

test('o painel traz o headcount dos últimos 12 meses, com admitidos, desligados e turnover do mês', async () => {
  globalThis.fetch = apiFalsa(() => json(resumoDaAlfa));
  const { host } = await renderDashboard();
  assert.deepEqual(
    chamadas.filter((url) => url.includes('/relatorios/headcount')).map((url) => new URL(url, 'http://localhost').searchParams.get('de')),
    [mesesAntes(MES, 11)],
  );
  assert.match(host.textContent ?? '', /Colaboradores ativos por mês/);
  const grafico = host.querySelector('figure svg');
  assert.equal(grafico?.getAttribute('viewBox'), '0 0 720 260');
  assert.equal(grafico?.querySelectorAll('path').length, 1, 'o headcount é uma linha, não barras');
  assert.match(host.querySelector('figure table caption')?.textContent ?? '', /eixo vertical ajustado de 15 a 35/);
  const linhas = [...host.querySelectorAll('figure table tbody tr')];
  assert.equal(linhas.length, 12, 'uma linha por mês, para o leitor de tela');
  assert.deepEqual([...linhas.at(-1)!.querySelectorAll('td')].map((c) => c.textContent), ['31', '2', '1']);
  assert.match(host.textContent ?? '', /2 admitidos/);
  assert.match(host.textContent ?? '', /1 desligado/);
  assert.match(host.textContent ?? '', /Turnover 4,4%/);
  assert.equal([...host.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/admin/relatorios'), true);
  assert.doesNotMatch(host.textContent ?? '', /Atividades Recentes/);
});

test('os aniversariantes do mês aparecem em lista curta, com o resto no relatório', async () => {
  globalThis.fetch = apiFalsa(() => json(resumoDaAlfa));
  const { host } = await renderDashboard();
  assert.match(host.textContent ?? '', /Aniversariantes de /);
  assert.match(host.textContent ?? '', /Aniversariante 1dia 1/);
  assert.match(host.textContent ?? '', /Aniversariante 6dia 6/);
  assert.doesNotMatch(host.textContent ?? '', /Aniversariante 7/);
  assert.match(host.textContent ?? '', /e mais 2/);
});

test('sem aniversariantes ou com falha no relatório, o resto do painel continua de pé', async () => {
  globalThis.fetch = apiFalsa(() => json(resumoDaAlfa), { aniversariantes: () => json([]), headcount: () => json({ erro: 'Falha.' }, 500) });
  const { host } = await renderDashboard();
  assert.match(host.textContent ?? '', /Ninguém faz aniversário neste mês/);
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /Erro ao carregar o headcount/);
  assert.match(cartao(host, 'Colaboradores')?.textContent ?? '', /^Colaboradores3/, 'os cartões não dependem do relatório');
});
