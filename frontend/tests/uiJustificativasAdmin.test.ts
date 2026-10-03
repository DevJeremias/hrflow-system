// Fila de justificativas da gestão de ponto no design system: campos nomeados, ações com nome por pessoa e dia,
// feedback de sucesso por toast e de erro na linha, abas WAI-ARIA na página.
import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, botaoPorTexto, clicar, createElement, desmontarTudo, dom, esperar, montar, porRole, teclar } from './support/ui.ts';
import { createServer } from 'vite';
import type { ComponentType } from 'react';
import type { ViteDevServer } from 'vite';
import { comConsulta } from './support/consulta.ts';

let server: ViteDevServer;
let JustificativasPonto: ComponentType<{ mes: string }>;
let TimeTracking: ComponentType;
let UiProviders: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;

type Pedido = { metodo: string; caminho: string; corpo?: string };
let pedidos: Pedido[] = [];
let fila: unknown[] = [];
let respostaDaDecisao: () => Response;

const json = (corpo: unknown, status = 200, cabecalhos: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', ...cabecalhos } });

const justificativa = (id: number, nome: string, parcial: Record<string, unknown> = {}) => ({
  id, funcionario_id: id, nome_funcionario: nome, date: '2026-10-07', note: `Nota de ${nome}.`, status: 'pendente', reply: null,
  decidedBy: null, decidedAt: null, createdAt: '2026-10-08T12:00:00.000Z', updatedAt: '2026-10-08T12:00:00.000Z', ...parcial,
});

before(async () => {
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true, ws: false }, appType: 'custom' });
  ({ default: JustificativasPonto } = await server.ssrLoadModule('/src/components/Admin/JustificativasPonto.tsx'));
  ({ default: TimeTracking } = await server.ssrLoadModule('/src/pages/Admin/TimeTracking.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = String(entrada).replace(/^\/api/, '');
    const metodo = (init?.method ?? 'GET').toUpperCase();
    pedidos.push({ metodo, caminho, corpo: init?.body as string | undefined });
    if (metodo === 'PATCH') return respostaDaDecisao();
    if (caminho.startsWith('/ponto/justificativas')) return json(fila);
    return json([], 200, { 'X-Total-Count': '0' });
  }) as typeof fetch;
});
after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
  dom.window.close();
});
afterEach(async () => {
  await desmontarTudo();
  pedidos = [];
});
const preparar = () => {
  pedidos = [];
  fila = [justificativa(11, 'Ana'), justificativa(12, 'Caio', { note: 'Consulta.' })];
  respostaDaDecisao = () => json(justificativa(11, 'Ana', { status: 'aprovada' }));
};

const abrir = async (Tela: ComponentType<{ mes: string }> | ComponentType, props: Record<string, unknown> = {}) => {
  preparar();
  const host = await montar(comConsulta(createElement(UiProviders, null, createElement(Tela as ComponentType<Record<string, unknown>>, props))));
  await esperar(20);
  return host;
};

const digitar = async (campo: HTMLTextAreaElement, valor: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!.call(campo, valor);
    campo.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};

test('a fila lista uma justificativa por linha e todo controle tem id, name e <label for>', async () => {
  const host = await abrir(JustificativasPonto, { mes: '2026-10' });
  assert.equal(host.querySelectorAll('ul > li').length, 2);
  assert.equal(host.querySelectorAll('li')[0].textContent?.includes('Ana'), true);

  await clicar(botaoPorTexto(host, /Recusar justificativa de Ana/));
  const controles = host.querySelectorAll<HTMLInputElement>('input, select, textarea');
  assert.equal(controles.length, 2, 'o filtro de status e o motivo da recusa');
  for (const controle of controles) {
    assert.ok(controle.id && controle.name, 'id e name');
    assert.ok(host.querySelector(`label[for="${controle.id}"]`), `label para ${controle.name}`);
  }
  assert.equal(document.activeElement?.getAttribute('name'), 'motivo', 'o foco vai ao motivo da recusa');
});

test('cada ação diz de quem e de que dia é, mesmo sendo curta na tela', async () => {
  const host = await abrir(JustificativasPonto, { mes: '2026-10' });
  const nomes = [...host.querySelectorAll('li button')].map((b) => b.textContent);
  assert.deepEqual(nomes, [
    'Aprovar justificativa de Ana em 07/10/2026', 'Recusar justificativa de Ana em 07/10/2026',
    'Aprovar justificativa de Caio em 07/10/2026', 'Recusar justificativa de Caio em 07/10/2026',
  ]);
});

test('aprovar envia o PATCH, recarrega a fila e avisa por toast', async () => {
  const host = await abrir(JustificativasPonto, { mes: '2026-10' });
  await clicar(botaoPorTexto(host, /Aprovar justificativa de Ana/));
  await esperar(20);
  const patch = pedidos.find((p) => p.metodo === 'PATCH')!;
  assert.deepEqual([patch.caminho, patch.corpo], ['/ponto/justificativas/11', JSON.stringify({ status: 'aprovada' })]);
  assert.equal(pedidos.filter((p) => p.metodo === 'GET' && p.caminho.startsWith('/ponto/justificativas')).length, 2, 'a fila é consultada de novo');
  assert.equal(document.querySelector('[role="status"]')?.textContent, 'Justificativa aprovada.');
});

test('recusar só confirma com motivo e avisa por toast', async () => {
  const host = await abrirTelaDeRecusa();
  const confirmar = botaoPorTexto(host, /^Confirmar recusa$/) as HTMLButtonElement;
  assert.equal(confirmar.disabled, true);
  await digitar(host.querySelector('textarea')!, '  Sem atestado.  ');
  await clicar(botaoPorTexto(host, /^Confirmar recusa$/));
  await esperar(20);
  assert.equal(pedidos.find((p) => p.metodo === 'PATCH')!.corpo, JSON.stringify({ status: 'recusada', resposta: 'Sem atestado.' }));
  assert.equal(document.querySelector('[role="status"]')?.textContent, 'Justificativa recusada.');
});

async function abrirTelaDeRecusa() {
  const host = await abrir(JustificativasPonto, { mes: '2026-10' });
  await clicar(botaoPorTexto(host, /Recusar justificativa de Ana/));
  return host;
}

test('a falha ao decidir fica na linha da justificativa e não vira toast de sucesso', async () => {
  const host = await abrir(JustificativasPonto, { mes: '2026-10' });
  respostaDaDecisao = () => json({ erro: 'Você não pode decidir a justificativa do seu próprio ponto.' }, 403);
  await clicar(botaoPorTexto(host, /Aprovar justificativa de Ana/));
  await esperar(20);
  const linha = host.querySelectorAll('li')[0];
  assert.match(linha.querySelector('[role="alert"]')?.textContent ?? '', /próprio ponto/);
  assert.equal(document.querySelector('[role="status"]')?.textContent, '');
  assert.equal(host.querySelectorAll('li').length, 2, 'a fila continua igual');
});

test('fila vazia mostra o estado vazio com texto, não uma lista em branco', async () => {
  preparar();
  fila = [];
  const host = await montar(createElement(UiProviders, null, createElement(JustificativasPonto, { mes: '2026-10' })));
  await esperar(20);
  assert.match(host.textContent ?? '', /Nenhuma justificativa pendente neste mês\./);
});

test('a gestão de ponto tem abas WAI-ARIA, painel nomeado e título da aba', async () => {
  const host = await abrir(TimeTracking);
  assert.equal(document.title, 'Gestão de ponto | HRFlow');
  assert.ok(porRole(host, 'tablist'));
  const abas = [...host.querySelectorAll<HTMLElement>('[role="tab"]')];
  assert.deepEqual(abas.map((aba) => [aba.textContent, aba.getAttribute('aria-selected'), aba.tabIndex]), [['Marcações', 'true', 0], ['Justificativas', 'false', -1]]);
  const painel = porRole(host, 'tabpanel')!;
  assert.equal(painel.getAttribute('aria-labelledby'), abas[0].id);
  assert.equal(abas[0].getAttribute('aria-controls'), painel.id);

  abas[0].focus();
  await teclar(abas[0], 'ArrowRight');
  await esperar(20);
  assert.equal(document.activeElement?.id, abas[1].id);
  assert.equal(abas[1].getAttribute('aria-selected'), 'true');
  assert.equal(porRole(host, 'tabpanel')!.getAttribute('aria-labelledby'), abas[1].id);
  assert.match(pedidos.at(-1)!.caminho, /^\/ponto\/justificativas\?mes=\d{4}-\d{2}&status=pendente$/);
  assert.equal(host.querySelectorAll('h1').length, 1);
});
