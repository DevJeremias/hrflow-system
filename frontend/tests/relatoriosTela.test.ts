// A tela de relatórios: uma aba por relatório, tabela com os totais da API, exportação em CSV e PDF pelo
// mesmo filtro da tela, e o estado de "folha não processada" no custo por departamento.
import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRouter } from 'react-router-dom';
import { act, clicar, createElement, desmontarTudo, dom, esperar, iniciarVite, montar, teclar } from './support/ui.ts';
import { comConsulta } from './support/consulta.ts';
import { mesAtualNoFuso, mesesAntes } from '../src/utils/competencia.ts';
import type { ComponentType } from 'react';
import type { ViteDevServer } from 'vite';

let server: ViteDevServer;
let Reports: ComponentType;
let UiProviders: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;

let pedidos: string[] = [];
let custoNaoProcessado = false;
const MES = mesAtualNoFuso();

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

const HEADCOUNT = [
  { mes: '2026-08', admitidos: 2, desligados: 0, ativos: 12, turnover: 0 },
  { mes: '2026-09', admitidos: 1, desligados: 1, ativos: 12, turnover: 8.3 },
];
const linhaDeCusto = (departamento: string, colaboradores: number, bruto: number) => ({ departamento, colaboradores, bruto, descontos: bruto / 10, liquido: bruto * 0.9, encargos: bruto / 5, custoTotal: bruto * 1.2 });
const CUSTO = {
  competencia: MES, statusDaFolha: 'fechada',
  departamentos: [linhaDeCusto('Financeiro', 1, 2000), linhaDeCusto('Tecnologia', 2, 9000)],
  total: linhaDeCusto('Total', 3, 11000),
};
const ABSENTEISMO = {
  mes: MES,
  departamentos: [{ departamento: 'Tecnologia', colaboradores: 2, diasApurados: 40, faltas: 2, ausenciasJustificadas: 1, atrasos: 3, taxa: 7.5 }],
  total: { departamento: 'Total', colaboradores: 2, diasApurados: 40, faltas: 2, ausenciasJustificadas: 1, atrasos: 3, taxa: 7.5 },
};
const ANIVERSARIANTES = [{ funcionarioId: 1, nome: 'Ana Ficticia', departamento: 'Tecnologia', cargo: null, dia: 12 }];

before(async () => {
  server = await iniciarVite();
  ({ default: Reports } = await server.ssrLoadModule('/src/pages/Admin/Reports.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const caminho = String(entrada).replace(/^\/api/, '');
    pedidos.push(caminho);
    if (caminho.startsWith('/relatorios/headcount')) return json(HEADCOUNT);
    if (caminho.startsWith('/relatorios/custo-departamento')) {
      return custoNaoProcessado ? json({ erro: 'A folha de 10/2026 ainda não foi processada.' }, 404) : json(CUSTO);
    }
    if (caminho.startsWith('/relatorios/absenteismo')) return json(ABSENTEISMO);
    if (caminho.startsWith('/relatorios/aniversariantes')) return json(ANIVERSARIANTES);
    return json({ erro: 'rota inesperada no teste' }, 404);
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
  custoNaoProcessado = false;
});

const abrir = async () => {
  const host = await montar(comConsulta(createElement(MemoryRouter, null, createElement(UiProviders, null, createElement(Reports)))));
  await esperar(20);
  return host;
};
const aba = (host: HTMLElement, nome: RegExp) => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((a) => nome.test(a.textContent ?? ''))!;
const exportacoes = (host: HTMLElement) => Object.fromEntries([...host.querySelectorAll<HTMLAnchorElement>('a[download]')].map((a) => [a.textContent?.trim(), a.getAttribute('href')]));

test('a página tem um título, abas WAI-ARIA e o título da aba do navegador', async () => {
  const host = await abrir();
  assert.equal(document.title, 'Relatórios | HRFlow');
  assert.equal(host.querySelectorAll('h1').length, 1);
  assert.deepEqual([...host.querySelectorAll('[role="tab"]')].map((a) => a.textContent), ['Headcount e turnover', 'Custo por departamento', 'Absenteísmo', 'Aniversariantes']);
  assert.equal(aba(host, /Headcount/).getAttribute('aria-selected'), 'true');
  const painel = host.querySelector('[role="tabpanel"]')!;
  assert.equal(painel.getAttribute('aria-labelledby'), aba(host, /Headcount/).id);
});

test('o headcount traz os últimos 12 meses por padrão e a tabela com os totais do período', async () => {
  const host = await abrir();
  const pedido = new URL(pedidos.find((p) => p.startsWith('/relatorios/headcount'))!, 'http://localhost').searchParams;
  assert.equal(pedido.get('ate'), MES);
  assert.equal(pedido.get('de'), mesesAntes(MES, 11));

  const linhas = [...host.querySelectorAll('table:not(.sr-only) tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent));
  assert.deepEqual(linhas, [['agosto de 2026', '2', '0', '12', '0,0%'], ['setembro de 2026', '1', '1', '12', '8,3%']]);
  const rodape = [...host.querySelectorAll('table:not(.sr-only) tfoot td')].map((td) => td.textContent);
  assert.deepEqual(rodape, ['No período', '3', '1', '12', '']);
  assert.ok(host.querySelector('figure'), 'o gráfico de ativos por mês');
});

test('mexer numa ponta do período arrasta a outra: o período nunca fica invertido', async () => {
  const host = await abrir();
  const ate = host.querySelector<HTMLInputElement>('[name="ate"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(ate, mesesAntes(MES, 14));
    ate.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await esperar(20);
  assert.equal(host.querySelector<HTMLInputElement>('[name="de"]')!.value, mesesAntes(MES, 14));
  assert.equal(host.querySelector<HTMLInputElement>('[name="ate"]')!.value, mesesAntes(MES, 14));
});

test('exportar leva os mesmos filtros da tela, em CSV e em PDF, como link de download', async () => {
  const host = await abrir();
  assert.deepEqual(exportacoes(host), {
    'Exportar CSV': `/api/relatorios/headcount?de=${mesesAntes(MES, 11)}&ate=${MES}&formato=csv`,
    'Exportar PDF': `/api/relatorios/headcount?de=${mesesAntes(MES, 11)}&ate=${MES}&formato=pdf`,
  });
});

test('o custo por departamento mostra moeda, o status da folha e o total do rodapé', async () => {
  const host = await abrir();
  await clicar(aba(host, /Custo/));
  await esperar(20);
  assert.match(host.textContent ?? '', /Folha fechada/);
  const linhas = [...host.querySelectorAll('table:not(.sr-only) tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent?.replace(/\s/g, ' ')));
  assert.deepEqual(linhas[1], ['Tecnologia', '2', 'R$ 9.000,00', 'R$ 900,00', 'R$ 8.100,00', 'R$ 1.800,00', 'R$ 10.800,00']);
  assert.deepEqual([...host.querySelectorAll('table:not(.sr-only) tfoot td')].map((td) => td.textContent?.replace(/\s/g, ' ')), ['Total', '3', 'R$ 11.000,00', 'R$ 1.100,00', 'R$ 9.900,00', 'R$ 2.200,00', 'R$ 13.200,00']);
  assert.equal(exportacoes(host)['Exportar PDF'], `/api/relatorios/custo-departamento?competencia=${MES}&formato=pdf`);
});

test('folha ainda não processada vira um convite para processá-la, não um erro', async () => {
  custoNaoProcessado = true;
  const host = await abrir();
  await clicar(aba(host, /Custo/));
  await esperar(20);
  assert.equal(host.querySelector('[role="alert"]'), null);
  assert.match(host.textContent ?? '', /ainda não foi processada/);
  assert.equal([...host.querySelectorAll('a')].find((a) => /Ir para a folha de pagamento/.test(a.textContent ?? ''))?.getAttribute('href'), '/admin/folha');
});

test('o absenteísmo mostra faltas, justificadas, atrasos e a taxa, e explica a conta', async () => {
  const host = await abrir();
  await clicar(aba(host, /Absenteísmo/));
  await esperar(20);
  assert.deepEqual([...host.querySelectorAll('table:not(.sr-only) tbody tr td')].map((td) => td.textContent), ['Tecnologia', '2', '40', '2', '1', '3', '7,5%']);
  assert.match(host.textContent ?? '', /Taxa: \(faltas \+ justificadas\) sobre os dias apurados/);
  assert.equal(exportacoes(host)['Exportar CSV'], `/api/relatorios/absenteismo?mes=${MES}&formato=csv`);
});

test('os aniversariantes listam o dia sem o ano de nascimento', async () => {
  const host = await abrir();
  await clicar(aba(host, /Aniversariantes/));
  await esperar(20);
  assert.deepEqual([...host.querySelectorAll('table:not(.sr-only) tbody tr td')].map((td) => td.textContent), ['12', 'Ana Ficticia', 'Tecnologia', '—']);
});

test('as setas trocam de aba e cada uma carrega só o próprio relatório', async () => {
  const host = await abrir();
  assert.deepEqual([...new Set(pedidos.map((p) => p.split('?')[0]))], ['/relatorios/headcount']);
  aba(host, /Headcount/).focus();
  await teclar(host.querySelector('[role="tablist"]')!, 'ArrowRight');
  await esperar(20);
  assert.equal(aba(host, /Custo/).getAttribute('aria-selected'), 'true');
  assert.ok(pedidos.some((p) => p.startsWith('/relatorios/custo-departamento')));
  assert.equal(pedidos.some((p) => p.startsWith('/relatorios/absenteismo')), false);
});
