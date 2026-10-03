import { dom } from './support/jsdom.ts';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, act, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer, type ViteDevServer } from 'vite';
import type { HistoryDay, MonthTotals } from '../src/services/pontoService.ts';

let server: ViteDevServer;
interface PropsDoEspelho {
  month: string;
  setMonth: (mes: string) => void;
  historyData: HistoryDay[];
  monthTotals: MonthTotals | null;
  onSaveNote: (id: string, note: string) => Promise<void>;
}

let Espelho: ComponentType<PropsDoEspelho>;
let JustificativasPonto: ComponentType<{ mes: string }>;
let TimeTracking: ComponentType;
const originalFetch = globalThis.fetch;

before(async () => {
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true }, appType: 'custom' });
  ({ default: Espelho } = await server.ssrLoadModule('/src/components/Portal/DashboardTimeMirror.tsx'));
  ({ default: JustificativasPonto } = await server.ssrLoadModule('/src/components/Admin/JustificativasPonto.tsx'));
  ({ default: TimeTracking } = await server.ssrLoadModule('/src/pages/Admin/TimeTracking.tsx'));
});

after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
  dom.window.close();
});

const dia = (data: string, parcial: Partial<HistoryDay> = {}): HistoryDay => ({
  id: data, date: data, entry: '--:--', lunchOut: '--:--', lunchIn: '--:--', exit: '--:--', totalHours: '--:--',
  status: 'falta', open: false, delay: '00:00', note: '', noteStatus: null, noteReply: null, negativeAdjust: '08:00', positiveAdjust: '00:00',
  ...parcial,
});

const totais: MonthTotals = {
  workSchedule: { weeklyHours: 40, entry: '08:00', exit: '17:00', toleranceMinutes: 10 },
  totals: [{ id: '2026-10-01', weekLabel: '01/10 a 04/10', workloadLimit: '16:00', workloadDone: '16:00', pendingTime: '00:00', excessTime: '00:00', delayTime: '00:30', absences: 0, incompleteDays: 0 }],
  monthlySummary: { workloadLimit: '176:00', workloadDone: '16:00', pendingTime: '104:00', excessTime: '04:00', delayTime: '00:30', absences: 13, incompleteDays: 1 },
};

const renderizar = async (elemento: ReturnType<typeof createElement>) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(elemento); });
  return { host, root, desmontar: async () => { await act(async () => root.unmount()); host.remove(); } };
};

const botao = (host: HTMLElement, texto: RegExp | string) => [...host.querySelectorAll('button')].find((b) => (typeof texto === 'string' ? b.textContent === texto : texto.test(`${b.textContent} ${b.getAttribute('aria-label')}`)));

const espelho = (dias: HistoryDay[], onSaveNote: (id: string, note: string) => Promise<void> = async () => {}, setMonth: (mes: string) => void = () => {}) => createElement(Espelho, {
  month: '2026-09', setMonth, historyData: dias, monthTotals: totais, onSaveNote,
});

test('o espelho mostra horas, atraso, status e o botão de nota em dia útil sem marcação', async () => {
  const dias = [
    dia('2026-09-01', { entry: '08:00', lunchOut: '12:00', lunchIn: '13:00', exit: '17:00', totalHours: '08:00', status: 'ok', negativeAdjust: '00:00' }),
    dia('2026-09-02', { entry: '08:30', exit: '17:30', totalHours: '09:00', status: 'atraso', delay: '00:30', negativeAdjust: '00:00', positiveAdjust: '00:30' }),
    dia('2026-09-05', { status: 'fim_de_semana', negativeAdjust: '00:00' }),
    dia('2026-09-07'),
    dia('2026-09-08', { entry: '08:00', status: 'incompleto', negativeAdjust: '00:00' }),
  ];
  const { host, desmontar } = await renderizar(espelho(dias));
  const texto = host.textContent ?? '';
  assert.match(texto, /01\/09\/2026/);
  assert.match(texto, /Atraso/);
  assert.match(texto, /Falta/);
  assert.match(texto, /Incompleto/);
  assert.match(texto, /Fim de semana/);
  // O botão não depende de hover: está no DOM e sem a classe que o esconde.
  const adicionar = botao(host, /Adicionar nota em 07\/09\/2026/);
  assert.ok(adicionar, 'dia útil sem marcação precisa do botão de nota');
  assert.doesNotMatch(adicionar.className, /opacity-0/);
  assert.ok(botao(host, /Adicionar nota em 01\/09\/2026/), 'dia completo também pode receber nota');
  assert.equal(botao(host, /Adicionar nota em 05\/09\/2026/), undefined, 'fim de semana não pede justificativa');
  assert.match(texto, /Jornada: 08:00 às 17:00, 40h semanais, tolerância de 10 min/);
  assert.match(texto, /Total Mensal176:00/);
  await desmontar();
});

test('mês sem marcações mostra a mensagem de estado vazio, mas mantém os dias', async () => {
  const { host, desmontar } = await renderizar(espelho([dia('2026-09-07'), dia('2026-09-08')]));
  assert.match(host.textContent ?? '', /Nenhuma marcação registrada neste mês/);
  assert.ok(botao(host, /Adicionar nota em 07\/09\/2026/));
  await desmontar();
});

test('o modal descreve o fluxo real: vai ao RH, que aprova ou recusa', async () => {
  const { host, desmontar } = await renderizar(espelho([dia('2026-09-07', { entry: '08:00', exit: '17:00', status: 'ok' })]));
  await act(async () => { botao(host, /Adicionar nota em 07\/09\/2026/)?.click(); });
  const texto = document.body.textContent ?? host.textContent ?? '';
  assert.match(texto, /enviada ao RH, que vai aprová-la ou recusá-la/);
  assert.doesNotMatch(texto, /gestor/);
  await desmontar();
});

test('justificar um dia sem marcação chama a gravação com o dia e o texto', async () => {
  const chamadas: Array<[string, string]> = [];
  const { host, desmontar } = await renderizar(espelho([dia('2026-09-07')], async (id, nota) => { chamadas.push([id, nota]); }));
  await act(async () => { botao(host, /Adicionar nota em 07\/09\/2026/)?.click(); });
  const campo = host.querySelector('textarea') as HTMLTextAreaElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!;
    setter.call(campo, 'Consulta médica.');
    campo.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await act(async () => { botao(host, 'Enviar Justificativa')?.click(); });
  assert.deepEqual(chamadas, [['2026-09-07', 'Consulta médica.']]);
  assert.equal(host.querySelector('[role="dialog"]'), null, 'o modal fecha depois da confirmação');
  await desmontar();
});

test('justificativa recusada mostra o motivo e permite reenviar; aprovada fica só para leitura', async () => {
  const recusada = dia('2026-09-07', { note: 'Perdi o ônibus.', noteStatus: 'recusada', noteReply: 'Sem comprovante.' });
  const aprovada = dia('2026-09-08', { note: 'Atestado.', noteStatus: 'aprovada', status: 'justificado', negativeAdjust: '00:00' });
  const { host, desmontar } = await renderizar(espelho([recusada, aprovada]));
  assert.match(host.textContent ?? '', /Recusada/);
  assert.match(host.textContent ?? '', /Aprovada/);

  await act(async () => { botao(host, /Justificativa de 07\/09\/2026/)?.click(); });
  assert.match(host.textContent ?? '', /O RH recusou esta justificativa: Sem comprovante\./);
  assert.ok(botao(host, 'Reenviar Justificativa'));
  await act(async () => { botao(host, 'Fechar')?.click(); });

  await act(async () => { botao(host, /Justificativa de 08\/09\/2026/)?.click(); });
  assert.match(host.textContent ?? '', /O RH aprovou esta justificativa/);
  assert.equal(botao(host, 'Enviar Justificativa'), undefined);
  assert.equal(botao(host, 'Reenviar Justificativa'), undefined);
  assert.equal((host.querySelector('textarea') as HTMLTextAreaElement).disabled, true);
  await desmontar();
});

test('limpar o campo de mês não troca o mês nem gera pedido inválido', async () => {
  const meses: string[] = [];
  const { host, desmontar } = await renderizar(espelho([dia('2026-09-07')], undefined, (mes) => meses.push(mes)));
  const campo = host.querySelector('input[type="month"]') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => { setter.call(campo, ''); campo.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  assert.deepEqual(meses, []);
  await act(async () => { setter.call(campo, '2026-08'); campo.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  assert.deepEqual(meses, ['2026-08']);
  await desmontar();
});

const justificativa = (id: number, parcial: Record<string, unknown> = {}) => ({
  id, funcionario_id: 7, nome_funcionario: 'Ana', date: '2026-10-07', note: 'Consulta médica.', status: 'pendente', reply: null,
  decidedBy: null, decidedAt: null, createdAt: '2026-10-08T12:00:00.000Z', updatedAt: '2026-10-08T12:00:00.000Z', ...parcial,
});

const respostaJson = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

test('o RH vê as justificativas pendentes e aprova uma', async () => {
  const pedidos: Array<[string, string | undefined, string | undefined]> = [];
  let pendentes = [justificativa(11)];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    pedidos.push([String(url), init?.method, init?.body as string | undefined]);
    if (init?.method === 'PATCH') {
      pendentes = [];
      return respostaJson(justificativa(11, { status: 'aprovada' }));
    }
    return respostaJson(pendentes);
  }) as typeof fetch;
  const { host, desmontar } = await renderizar(createElement(JustificativasPonto, { mes: '2026-10' }));
  assert.equal(pedidos[0][0], '/api/ponto/justificativas?mes=2026-10&status=pendente');
  assert.match(host.textContent ?? '', /Ana/);
  assert.match(host.textContent ?? '', /07\/10\/2026/);
  assert.match(host.textContent ?? '', /Consulta médica\./);

  await act(async () => { botao(host, /Aprovar justificativa de Ana/)?.click(); });
  assert.deepEqual(pedidos.find(([, metodo]) => metodo === 'PATCH'), ['/api/ponto/justificativas/11', 'PATCH', JSON.stringify({ status: 'aprovada' })]);
  assert.match(host.textContent ?? '', /Nenhuma justificativa pendente neste mês/);
  await desmontar();
});

test('recusar pede o motivo e só envia com ele', async () => {
  const corpos: string[] = [];
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      corpos.push(init.body as string);
      return respostaJson(justificativa(12, { status: 'recusada', reply: 'Sem atestado.' }));
    }
    return respostaJson([justificativa(12)]);
  }) as typeof fetch;
  const { host, desmontar } = await renderizar(createElement(JustificativasPonto, { mes: '2026-10' }));
  await act(async () => { botao(host, /Recusar justificativa de Ana/)?.click(); });
  const confirmar = botao(host, 'Confirmar recusa') as HTMLButtonElement;
  assert.equal(confirmar.disabled, true, 'sem motivo não há como confirmar');
  const campo = host.querySelector('textarea') as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!.call(campo, 'Sem atestado.');
    campo.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await act(async () => { (botao(host, 'Confirmar recusa') as HTMLButtonElement).click(); });
  assert.deepEqual(corpos, [JSON.stringify({ status: 'recusada', resposta: 'Sem atestado.' })]);
  await desmontar();
});

test('a falha ao decidir aparece na linha e a justificativa continua na fila', async () => {
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => (
    init?.method === 'PATCH' ? respostaJson({ erro: 'Você não pode decidir a justificativa do seu próprio ponto.' }, 403) : respostaJson([justificativa(13)])
  )) as typeof fetch;
  const { host, desmontar } = await renderizar(createElement(JustificativasPonto, { mes: '2026-10' }));
  await act(async () => { botao(host, /Aprovar justificativa de Ana/)?.click(); });
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /próprio ponto/);
  assert.match(host.textContent ?? '', /Consulta médica\./);
  await desmontar();
});

test('o filtro de status refaz a consulta', async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => { urls.push(String(url)); return respostaJson([]); }) as typeof fetch;
  const { host, desmontar } = await renderizar(createElement(JustificativasPonto, { mes: '2026-10' }));
  const filtro = host.querySelector('select') as HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!.call(filtro, 'recusada');
    filtro.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  assert.equal(urls.at(-1), '/api/ponto/justificativas?mes=2026-10&status=recusada');
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!.call(filtro, '');
    filtro.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  assert.equal(urls.at(-1), '/api/ponto/justificativas?mes=2026-10');
  await desmontar();
});

test('a gestão de ponto tem a aba Justificativas, que abre a fila do mês escolhido', async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    urls.push(String(url));
    return String(url).includes('/justificativas') ? respostaJson([justificativa(14)]) : new Response('[]', { status: 200, headers: { 'X-Total-Count': '0' } });
  }) as typeof fetch;
  const { host, desmontar } = await renderizar(createElement(TimeTracking));
  const abas = [...host.querySelectorAll('[role="tab"]')].map((aba) => aba.textContent);
  assert.deepEqual(abas, ['Marcações', 'Justificativas']);
  await act(async () => { (host.querySelectorAll('[role="tab"]')[1] as HTMLElement).click(); });
  assert.match(urls.at(-1) ?? '', /^\/api\/ponto\/justificativas\?mes=\d{4}-\d{2}&status=pendente$/);
  assert.match(host.textContent ?? '', /Consulta médica\./);
  await desmontar();
});
