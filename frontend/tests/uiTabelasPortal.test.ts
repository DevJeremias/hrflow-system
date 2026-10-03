// Tabelas do Portal do Colaborador: semântica, modo cartão no celular e nada cortado.
import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clicar, createElement, desmontarTudo, dom, esperar, iniciarVite, montar, porRole } from './support/ui.ts';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import type { ViteDevServer } from 'vite';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });

let server: ViteDevServer;
let Payslips: ComponentType;
let EmployeeDashboard: ComponentType;
let AuthProvider: ComponentType<{ children: unknown }>;
let UiProviders: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;

const json = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } });
const HOLERITE = {
  id: '7', name: 'Caio Ficticio', role: 'Analista', department: 'TI', baseSalary: 5000, totalEarnings: 0, totalDeductions: 400,
  totalGross: 5000, netSalary: 4600, employerCharges: 1390, earningsList: [], deductionsList: [{ description: 'INSS', value: 400 }],
  contract: 'CLT', competencia: '2026-09', empresa: { razaoSocial: 'Empresa Ficticia Alfa Ltda', cnpj: '11222333000181' },
};
const DIAS = [
  { id: '2026-10-01', date: '2026-10-01', entry: '08:00', lunchOut: '12:00', lunchIn: '13:00', exit: '17:00', totalHours: '08:00', status: 'ok', open: false, delay: '00:00', note: '', noteStatus: null, noteReply: null, negativeAdjust: '00:00', positiveAdjust: '00:00' },
  { id: '2026-10-02', date: '2026-10-02', entry: '08:30', lunchOut: '12:00', lunchIn: '13:00', exit: '17:00', totalHours: '07:30', status: 'atraso', open: false, delay: '00:30', note: 'Trânsito', noteStatus: 'pendente', noteReply: null, negativeAdjust: '00:30', positiveAdjust: '00:00' },
];
const SEMANA = { id: 's1', weekLabel: 'Semana 1', workloadLimit: '44:00', workloadDone: '39:30', pendingTime: '00:30', excessTime: '00:00', delayTime: '00:30', absences: 1, incompleteDays: 0 };
const TOTAL_MENSAL = { workloadLimit: '176:00', workloadDone: '158:00', pendingTime: '02:00', excessTime: '04:00', delayTime: '01:00', absences: 3, incompleteDays: 2 };
const JORNADA = { weeklyHours: 40, entry: '08:00', exit: '17:00', toleranceMinutes: 10 };

before(async () => {
  document.cookie = 'hrflow_csrf=token-ficticio; Path=/';
  server = await iniciarVite();
  Payslips = (await server.ssrLoadModule('/src/pages/Portal/Payslips.tsx')).default;
  EmployeeDashboard = (await server.ssrLoadModule('/src/pages/Portal/EmployeeDashboard.tsx')).default;
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const caminho = new URL(String(entrada), 'http://localhost').pathname.replace(/^\/api/, '');
    if (caminho === '/auth/sessao') return json({ id: 3, nome: 'Caio Ficticio', perfil: 'Colaborador', empresa_nome: 'Empresa Ficticia Alfa Ltda', funcionario_id: 7, avatar: null });
    if (caminho === '/folha/meus-holerites') return json([HOLERITE]);
    if (caminho.startsWith('/ponto/hoje/')) return json([]);
    if (caminho.startsWith('/ponto/historico/')) return json(DIAS);
    if (caminho.startsWith('/ponto/totais/')) return json({ workSchedule: JORNADA, totals: [SEMANA], monthlySummary: TOTAL_MENSAL });
    return new Response(JSON.stringify({ erro: 'rota inesperada' }), { status: 404 });
  }) as typeof fetch;
});
after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
});
afterEach(desmontarTudo);

const abrirPagina = async (Pagina: ComponentType) => {
  const host = await montar(createElement(QueryClientProvider, { client: new QueryClient() },
    createElement(MemoryRouter, null, createElement(AuthProvider, null, createElement(UiProviders, null, createElement(Pagina))))));
  for (let i = 0; i < 4; i += 1) await esperar(20);
  return host;
};

// Cada tabela tem legenda, cabeçalhos com scope e, em toda célula de dado, o rótulo que o modo cartão desenha.
const verificarTabela = (tabela: HTMLTableElement, colunasEsperadas: string[]) => {
  assert.ok(tabela.querySelector('caption')?.textContent, 'a tabela tem legenda');
  const cabecalhos = [...tabela.querySelectorAll('thead th')];
  assert.deepEqual(cabecalhos.map((th) => th.textContent), colunasEsperadas);
  for (const th of cabecalhos) assert.equal(th.getAttribute('scope'), 'col');
  for (const linha of tabela.querySelectorAll('tbody tr')) {
    const celulas = [...linha.querySelectorAll('td')];
    assert.equal(celulas.length, colunasEsperadas.length);
    for (const [i, celula] of celulas.entries()) {
      const rotulo = celula.getAttribute('data-label');
      assert.ok(rotulo === null || rotulo === colunasEsperadas[i], `data-label ${rotulo} não bate com ${colunasEsperadas[i]}`);
    }
  }
};

test('Meus Holerites: tabela semântica, ação nomeada e abertura do holerite', async () => {
  const host = await abrirPagina(Payslips);
  assert.equal(document.title, 'Meus holerites | HRFlow');
  assert.equal(host.querySelectorAll('h1').length, 1);
  assert.equal(host.querySelector('main'), null);
  const tabela = host.querySelector('table')!;
  verificarTabela(tabela, ['Mês de referência', 'Salário bruto', 'Descontos', 'Valor líquido', 'Ação']);
  const botao = tabela.querySelector('tbody button')!;
  assert.match(botao.getAttribute('aria-label') ?? '', /^Visualizar holerite de /);
  const ultima = tabela.querySelector('tbody tr')!.querySelectorAll('td')[4];
  assert.equal(ultima.getAttribute('data-label'), null, 'a coluna Ação ocupa a linha toda no cartão');

  await clicar(botao);
  await esperar();
  assert.equal(porRole(document, 'dialog')?.getAttribute('aria-modal'), 'true');
});

test('Meus Holerites: os três indicadores usam o StatCard e o último é o escuro', async () => {
  const host = await abrirPagina(Payslips);
  const rotulos = [...host.querySelectorAll('p.uppercase')].map((p) => p.textContent);
  assert.ok(rotulos.some((r) => /^Último bruto \(/.test(r ?? '')));
  assert.ok(rotulos.includes('Total descontado'));
  assert.ok(rotulos.includes('Líquido recebido'));
  assert.ok(host.querySelector('.bg-surface-inverse'), 'o líquido usa o tom inverso');
});

test('Espelho de ponto: as duas tabelas são semânticas, viram cartão no celular e o rodapé traz os totais', async () => {
  const host = await abrirPagina(EmployeeDashboard);
  const [diaria, semanal] = [...host.querySelectorAll('table')];
  verificarTabela(diaria, ['Data', 'Entrada', 'Pausa', 'Retorno', 'Saída', 'Horas', 'Atraso', 'Ajuste negativo', 'Ajuste positivo', 'Status', 'Justificativa']);
  assert.match(diaria.className, /\bxl:table\b/, 'abaixo de 1280 px a linha é um cartão; a coluna Justificativa nunca é cortada');
  assert.equal(diaria.querySelectorAll('tbody tr').length, 2);

  verificarTabela(semanal, ['Semana', 'Carga prevista', 'Horas trabalhadas', 'Pendente', 'Excedente', 'Atrasos', 'Faltas', 'Incompletos']);
  const rodape = semanal.querySelector('tfoot')!;
  assert.equal(rodape.querySelectorAll('td')[0].textContent, 'Total Mensal');
  assert.equal(rodape.querySelectorAll('td')[1].textContent, '176:00');
  assert.equal(rodape.querySelectorAll('td')[7].textContent, '2', 'o rodapé traz os dias incompletos do mês');
});

test('Espelho de ponto: o botão de justificativa é visível sem hover e tem nome acessível por dia', async () => {
  const host = await abrirPagina(EmployeeDashboard);
  const botoes = [...host.querySelectorAll('tbody button')].map((b) => b.textContent);
  assert.deepEqual(botoes, ['Adicionar nota em 01/10/2026', 'Justificativa de 02/10/2026: PendenteTrânsito']);
  assert.equal(host.querySelector('[class*="group-hover:opacity"], [class~="opacity-0"]'), null);
});

test('o status do dia vira Badge com tom: OK sucesso, Atraso alerta', async () => {
  const host = await abrirPagina(EmployeeDashboard);
  const emblemas = [...host.querySelectorAll('tbody td[data-label="Status"] span')];
  assert.match(emblemas[0].className, /bg-success-soft/);
  assert.match(emblemas[1].className, /bg-warning-soft/);
});

const arquivos = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivos(join(dir, e.name)) : [join(dir, e.name)]));
const raiz = new URL('../src/', import.meta.url).pathname;
const fontesDoPortal = [...arquivos(join(raiz, 'components/Portal')), ...arquivos(join(raiz, 'pages/Portal'))].filter((a) => a.endsWith('.tsx'));

test('o Portal não deixa largura mínima fixa, texto abaixo de 12 px, palette crua nem pt-PT nas fontes', () => {
  for (const arquivo of fontesDoPortal) {
    const texto = readFileSync(arquivo, 'utf8');
    assert.doesNotMatch(texto, /min-w-\[\d{3,}px\]/, `${arquivo} fixa largura mínima`);
    assert.doesNotMatch(texto, /text-\[(\d|1[01])px\]/, `${arquivo} usa texto abaixo de 12 px`);
    assert.doesNotMatch(texto, /\b(?:bg|text|border|from|to|ring)-(?:slate|indigo|emerald|rose|amber|blue)-\d{2,3}/, `${arquivo} usa paleta crua em vez de tokens`);
    assert.doesNotMatch(texto, /A carregar|Guardar|Utilizador|Tem a certeza|\balert\(/, `${arquivo} tem copy pt-PT ou alert`);
  }
});
