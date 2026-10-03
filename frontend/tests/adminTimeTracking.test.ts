import { after, before, test } from 'node:test';
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
let TimeTracking: ComponentType;
const originalFetch = globalThis.fetch;

before(async () => {
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true }, appType: 'custom' });
  ({ default: TimeTracking } = await server.ssrLoadModule('/src/pages/Admin/TimeTracking.tsx'));
});

after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
  dom.window.close();
});

const renderScreen = async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(TimeTracking)); });
  return { host, root };
};

test('mostra carregamento e depois dados reais com indicadores calculados', async () => {
  const mes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Belem', year: 'numeric', month: '2-digit' }).format(new Date());
  const data = `${mes}-12`;
  let resolveFetch: ((response: Response) => void) | undefined;
  let requestedUrl = '';
  globalThis.fetch = ((url: string | URL | Request) => {
    requestedUrl = String(url);
    return new Promise<Response>((resolve) => { resolveFetch = resolve; });
  }) as typeof fetch;
  const { host, root } = await renderScreen();
  assert.match(host.textContent ?? '', /Carregando registros de ponto/);

  await act(async () => {
    resolveFetch?.(new Response(JSON.stringify([
      { id: 1, funcionario_id: 7, tipo_registro: 'Entrada', nome_funcionario: 'Ana', date: data, time: '08:00:00' },
      { id: 2, funcionario_id: 7, tipo_registro: 'Saída', nome_funcionario: 'Ana', date: data, time: '17:00:00' },
    ]), { status: 200, headers: { 'X-Total-Count': '120' } }));
  });
  assert.equal(requestedUrl, `/api/ponto?mes=${mes}&pagina=1&limite=50`);
  assert.match(host.textContent ?? '', /Ana/);
  assert.match(host.textContent ?? '', new RegExp(`12/${mes.slice(5)}/${mes.slice(0, 4)}`));
  assert.match(host.textContent ?? '', /Entrada08:00(?!:)/);
  assert.doesNotMatch(host.textContent ?? '', /08:00:00/);
  assert.match(host.textContent ?? '', /Marcações no mês120/);
  assert.match(host.textContent ?? '', /Colaboradores nesta página1/);
  assert.match(host.textContent ?? '', /Página 1 de 3 · 120 marcações/);
  await act(async () => root.unmount());
  host.remove();
});

test('mostra estado vazio para uma resposta sem registros', async () => {
  globalThis.fetch = (async () => new Response('[]', { status: 200, headers: { 'X-Total-Count': '0' } })) as typeof fetch;
  const { host, root } = await renderScreen();
  assert.match(host.textContent ?? '', /Nenhum registro de ponto encontrado neste mês/);
  assert.match(host.textContent ?? '', /Marcações no mês0/);
  await act(async () => root.unmount());
  host.remove();
});

test('mostra erro de carregamento e oferece nova tentativa', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ erro: 'Falha ao consultar' }), { status: 500 })) as typeof fetch;
  const { host, root } = await renderScreen();
  assert.match(host.textContent ?? '', /Erro ao buscar os registros de ponto/);
  const retry = [...host.querySelectorAll('button')].find((botao) => botao.textContent === 'Tentar novamente');
  assert.ok(retry, 'a tela deve permitir nova tentativa');
  globalThis.fetch = (async () => new Response('[]', { status: 200, headers: { 'X-Total-Count': '0' } })) as typeof fetch;
  await act(async () => { retry.click(); });
  assert.match(host.textContent ?? '', /Nenhum registro de ponto encontrado neste mês/);
  await act(async () => root.unmount());
  host.remove();
});

test('Próxima pede a página seguinte do mesmo mês', async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    urls.push(String(url));
    return new Response(JSON.stringify([{ id: 1, funcionario_id: 7, tipo_registro: 'Entrada', nome_funcionario: 'Ana', date: '2026-10-02', time: '14:00:00' }]), {
      status: 200, headers: { 'X-Total-Count': '120' },
    });
  }) as typeof fetch;
  const { host, root } = await renderScreen();
  const proxima = [...host.querySelectorAll('button')].find((botao) => botao.textContent === 'Próxima');
  assert.ok(proxima);
  await act(async () => { proxima.click(); });
  assert.match(urls.at(-1) ?? '', /pagina=2&limite=50$/);
  assert.match(host.textContent ?? '', /Página 2 de 3/);
  assert.match(host.textContent ?? '', /02\/10\/2026/);
  await act(async () => root.unmount());
  host.remove();
});
