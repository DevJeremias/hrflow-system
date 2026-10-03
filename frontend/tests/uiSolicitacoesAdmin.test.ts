// Fila de solicitações (férias e afastamentos) do RH: o pedido com anexo, o saldo e o período aquisitivo de quem
// pede férias, a decisão (a recusa leva o motivo) e o que só a API decide (canDecide).
import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, botaoPorTexto, clicar, createElement, desmontarTudo, dom, esperar, montar } from './support/ui.ts';
import { createServer } from 'vite';
import type { ComponentType } from 'react';
import type { ViteDevServer } from 'vite';
import { comConsulta } from './support/consulta.ts';

let server: ViteDevServer;
let Requests: ComponentType;
let UiProviders: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;

type Pedido = { metodo: string; caminho: string; corpo?: string };
let pedidos: Pedido[] = [];
let fila: unknown[] = [];
let totalDaFila = 0;
let respostaDaDecisao: () => Response;
const salvos: Array<{ nome: string; href: string }> = [];

const json = (corpo: unknown, status = 200, cabecalhos: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', ...cabecalhos } });

const solicitacao = (id: number, nome: string, parcial: Record<string, unknown> = {}) => ({
  id, employeeId: id + 100, employeeName: nome, type: 'Férias', requestDate: '2026-10-03', startDate: '2026-11-02', endDate: '2026-11-11', days: 10,
  observation: `Descanso de ${nome}.`, hasAttachment: false, attachmentName: null, status: 'Pendente', reply: null, decidedBy: null, decidedAt: null, canDecide: true, ...parcial,
});

const SALDO = {
  admissao: '2024-01-15', periodoAquisitivo: { inicio: '2026-01-15', fim: '2027-01-14' }, periodosCompletos: 2, diasAdquiridos: 60,
  diasAprovados: 10, diasEmAnalise: 5, saldo: 45, prazoParaGozo: '2026-01-14', vencido: true,
};

before(async () => {
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true, ws: false }, appType: 'custom' });
  ({ default: Requests } = await server.ssrLoadModule('/src/pages/Admin/Requests.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  // O download vira um <a download> clicado: o jsdom não navega, e o teste só anota para onde ele apontaria.
  dom.window.HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) { salvos.push({ nome: this.download, href: this.href }); };
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = String(entrada).replace(/^\/api/, '');
    const metodo = (init?.method ?? 'GET').toUpperCase();
    pedidos.push({ metodo, caminho, corpo: init?.body as string | undefined });
    if (metodo === 'PATCH') return respostaDaDecisao();
    if (caminho.startsWith('/ausencias/saldo/')) return json(SALDO);
    if (/^\/ausencias\/\d+\/anexo$/.test(caminho)) return new Response('%PDF-1.4 atestado', { status: 200, headers: { 'Content-Type': 'application/pdf' } });
    if (caminho.startsWith('/ausencias')) return json(fila, 200, { 'X-Total-Count': String(totalDaFila) });
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
  salvos.length = 0;
});

const abrir = async (itens: unknown[] = [solicitacao(11, 'Ana'), solicitacao(12, 'Caio', { type: 'Licença Médica', hasAttachment: true, attachmentName: 'atestado.pdf', days: 3, startDate: '2026-10-01', endDate: '2026-10-03' })], total = itens.length) => {
  pedidos = [];
  fila = itens;
  totalDaFila = total;
  respostaDaDecisao = () => json(solicitacao(11, 'Ana', { status: 'Aprovada' }));
  const host = await montar(comConsulta(createElement(UiProviders, null, createElement(Requests))));
  await esperar(30);
  return host;
};

const digitar = async (campo: HTMLTextAreaElement, valor: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!.call(campo, valor);
    campo.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};

test('a fila começa pelos pendentes e cada pedido mostra quem pede, o tipo, o período, os dias e o motivo', async () => {
  const host = await abrir();
  assert.deepEqual(pedidos[0], { metodo: 'GET', caminho: '/ausencias?pagina=1&limite=50&status=Pendente', corpo: undefined });
  const itens = host.querySelectorAll('ul > li');
  assert.equal(itens.length, 2);
  const ana = itens[0].textContent ?? '';
  assert.match(ana, /Ana/);
  assert.match(ana, /Férias/);
  assert.match(ana, /02\/11\/2026 a 11\/11\/2026/);
  assert.match(ana, /10 dias · pedido em 03\/10\/2026/);
  assert.match(ana, /Descanso de Ana\./);
  assert.match(ana, /Pendente/);
  assert.match(host.textContent ?? '', /Página 1 de 1 · 2 solicitações/);
  assert.equal(document.title, 'Solicitações | HRFlow');
});

test('todo controle tem id, name e <label for>, e cada ação diz de quem e de que período é', async () => {
  const host = await abrir();
  await clicar(botaoPorTexto(host, /Recusar solicitação de Ana/));
  const controles = host.querySelectorAll<HTMLInputElement>('input, select, textarea');
  assert.equal(controles.length, 2, 'o filtro de status e o motivo da recusa');
  for (const controle of controles) {
    assert.ok(controle.id && controle.name, 'id e name');
    assert.ok(host.querySelector(`label[for="${controle.id}"]`), `label para ${controle.name}`);
  }
  assert.equal(document.activeElement?.getAttribute('name'), 'motivo');
  const nomes = [...host.querySelectorAll('li button')].map((b) => b.textContent).filter((t) => /^(Aprovar|Recusar)/.test(t ?? ''));
  assert.deepEqual(nomes, [
    'Aprovar solicitação de Ana, Férias de 02/11/2026 a 11/11/2026', 'Recusar solicitação de Ana, Férias de 02/11/2026 a 11/11/2026',
    'Aprovar solicitação de Caio, Licença Médica de 01/10/2026 a 03/10/2026', 'Recusar solicitação de Caio, Licença Médica de 01/10/2026 a 03/10/2026',
  ]);
});

test('o RH vê o saldo e o período aquisitivo de quem pede férias, sem o RH precisar pedir', async () => {
  const host = await abrir();
  assert.deepEqual(pedidos.filter((p) => p.caminho.startsWith('/ausencias/saldo')).map((p) => p.caminho), ['/ausencias/saldo/111'], 'só o pedido de férias consulta saldo');
  const saldo = host.querySelector('section[aria-label="Saldo de férias"]')!;
  const texto = saldo.textContent ?? '';
  assert.match(texto, /45 dias\s*disponíveis/);
  assert.match(texto, /Adquiridos60 dias/);
  assert.match(texto, /Aprovados10 dias/);
  assert.match(texto, /Em análise5 dias/);
  assert.match(texto, /Período aquisitivo em curso:15\/01\/2026 a 14\/01\/2027/);
  assert.match(texto, /Venceu em:14\/01\/2026/);
  assert.match(texto, /Prazo vencido/);
});

test('o saldo de um pedido já decidido só aparece quando o RH o abre', async () => {
  const host = await abrir([solicitacao(11, 'Ana', { status: 'Aprovada', canDecide: false, decidedBy: 'Rita', reply: null })]);
  assert.equal(host.querySelector('section[aria-label="Saldo de férias"]'), null);
  assert.equal(pedidos.filter((p) => p.caminho.startsWith('/ausencias/saldo')).length, 0);
  const alternar = botaoPorTexto(host, /Saldo e período aquisitivo/);
  assert.equal(alternar.getAttribute('aria-expanded'), 'false');
  await clicar(alternar);
  await esperar(20);
  assert.ok(host.querySelector('section[aria-label="Saldo de férias"]'));
  assert.equal(alternar.getAttribute('aria-expanded'), 'true');
  assert.match(host.textContent ?? '', /Decidida por Rita\./);
});

test('aprovar envia o PATCH com a decisão, recarrega a fila e avisa por toast', async () => {
  const host = await abrir();
  await clicar(botaoPorTexto(host, /Aprovar solicitação de Ana/));
  await esperar(30);
  const patch = pedidos.find((p) => p.metodo === 'PATCH')!;
  assert.deepEqual([patch.caminho, patch.corpo], ['/ausencias/11/decisao', JSON.stringify({ status: 'Aprovada' })]);
  assert.equal(pedidos.filter((p) => p.metodo === 'GET' && p.caminho.startsWith('/ausencias?')).length, 2, 'a fila é consultada de novo');
  assert.equal(document.querySelector('[role="status"]')?.textContent, 'Solicitação aprovada.');
});

test('recusar só confirma com motivo e o envia ao colaborador', async () => {
  const host = await abrir();
  await clicar(botaoPorTexto(host, /Recusar solicitação de Ana/));
  assert.equal((botaoPorTexto(host, /^Confirmar recusa$/) as HTMLButtonElement).disabled, true);
  await digitar(host.querySelector('textarea')!, '  Pico de entregas.  ');
  await clicar(botaoPorTexto(host, /^Confirmar recusa$/));
  await esperar(30);
  assert.equal(pedidos.find((p) => p.metodo === 'PATCH')!.corpo, JSON.stringify({ status: 'Recusada', resposta: 'Pico de entregas.' }));
  assert.equal(document.querySelector('[role="status"]')?.textContent, 'Solicitação recusada.');
});

test('o erro da decisão fica na linha do pedido, que continua com os botões', async () => {
  const host = await abrir();
  respostaDaDecisao = () => json({ erro: 'Esta solicitação já foi decidida.' }, 409);
  await clicar(botaoPorTexto(host, /Aprovar solicitação de Ana/));
  await esperar(30);
  const linha = host.querySelectorAll('ul > li')[0];
  assert.match(linha.querySelector('[role="alert"]')?.textContent ?? '', /já foi decidida/);
  assert.ok(botaoPorTexto(linha, /Aprovar solicitação de Ana/));
  assert.doesNotMatch(document.querySelector('[role="status"]')?.textContent ?? '', /Solicitação (aprovada|recusada)\./, 'sem toast de sucesso');
});

test('o pedido que o ator não decide (o próprio, ou de RH e Administrador) não oferece os botões', async () => {
  const host = await abrir([solicitacao(11, 'Rita', { canDecide: false })]);
  const texto = host.querySelector('li')!.textContent ?? '';
  assert.match(texto, /Você não decide esta solicitação/);
  assert.equal([...host.querySelectorAll('li button')].some((b) => /^(Aprovar|Recusar)/.test(b.textContent ?? '')), false);
});

test('o anexo é baixado pela API com o nome original', async () => {
  const host = await abrir();
  await clicar(botaoPorTexto(host, /atestado\.pdf/));
  await esperar(30);
  assert.ok(pedidos.some((p) => p.metodo === 'GET' && p.caminho === '/ausencias/12/anexo'));
  assert.equal(salvos.length, 1);
  assert.equal(salvos[0].nome, 'atestado.pdf');
  assert.match(salvos[0].href, /^blob:/);
});

test('o filtro troca o status consultado e a fila vazia diz o que falta', async () => {
  const host = await abrir([]);
  assert.match(host.textContent ?? '', /Nenhuma solicitação pendente\./);
  const filtro = host.querySelector<HTMLSelectElement>('select[name="status"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!.call(filtro, 'Aprovada');
    filtro.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await esperar(30);
  assert.equal(pedidos.at(-1)!.caminho, '/ausencias?pagina=1&limite=50&status=Aprovada');
  assert.match(host.textContent ?? '', /Nenhuma solicitação encontrada\./);

  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!.call(filtro, '');
    filtro.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await esperar(30);
  assert.equal(pedidos.at(-1)!.caminho, '/ausencias?pagina=1&limite=50', 'Todas não filtra por status');
});

test('a paginação usa o total do cabeçalho X-Total-Count', async () => {
  const host = await abrir([solicitacao(11, 'Ana')], 120);
  assert.match(host.textContent ?? '', /Página 1 de 3 · 120 solicitações/);
  await clicar(botaoPorTexto(host, /^Próxima$/));
  await esperar(30);
  assert.equal(pedidos.at(-1)!.caminho, '/ausencias?pagina=2&limite=50&status=Pendente');
});

test('falha ao carregar mostra o erro com nova tentativa, não uma fila vazia', async () => {
  pedidos = [];
  fila = [];
  globalThis.fetch = (async () => json({ erro: 'Erro interno ao buscar as solicitações.' }, 500)) as typeof fetch;
  const host = await montar(comConsulta(createElement(UiProviders, null, createElement(Requests))));
  await esperar(30);
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /Erro ao buscar as solicitações/);
  assert.ok(botaoPorTexto(host, /Tentar novamente/));
  assert.doesNotMatch(host.textContent ?? '', /Nenhuma solicitação/);
});
