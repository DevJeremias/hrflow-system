// Folha por competência na interface (B-12): o RH escolhe o mês, processa, confere e fecha; o
// colaborador vê um holerite por mês fechado; o Administrador mantém razão social e CNPJ. A API é
// simulada com o estado mínimo (uma folha por competência) para exercitar as telas de verdade.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { dom } from './support/jsdom.ts';
import { createElement, act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { novoQueryClient } from './support/consulta.ts';
import { createServer, type ViteDevServer } from 'vite';
import { mesAtualNoFuso } from '../src/utils/competencia.ts';

// O AuthProvider apaga as chaves legadas do localStorage ao carregar.
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });

const MES = mesAtualNoFuso();
const EMPRESA = { razaoSocial: 'Empresa Ficticia Alfa Ltda', cnpj: '11222333000181' };

const colaborador = (id: number, nome: string, salario: number, inss: number, contrato = 'CLT') => ({
  id: String(id), name: nome, role: 'Analista', department: 'Tecnologia', contract: contrato, baseSalary: salario, totalEarnings: 0,
  totalDeductions: inss, totalGross: salario, netSalary: salario - inss, employerCharges: contrato === 'CLT' ? salario * 0.278 : 0,
  inss, irrf: 0, fgts: 0, dependents: 0, bases: null, lancamentos: { adiantamento: 0, valeTransporte: 0, valeRefeicao: 0, planoSaude: 0 },
  earningsList: [], deductionsList: inss ? [{ description: 'Desconto INSS', value: inss, isPercentage: false, reference: null }] : [], chargesList: [],
});

const ANA = colaborador(7, 'Ana Souza Ficticia', 2900, 236.69);
const PAULO = colaborador(8, 'Paulo Pj Ficticio', 3000, 0, 'PJ');

interface FolhaDoServidor {
  competencia: string;
  status: 'aberta' | 'fechada';
  processadaEm: string;
  fechadaEm: string | null;
  empresa: typeof EMPRESA;
  regimeTributario: string | null;
  totais: { bruto: number; descontos: number; liquido: number; encargos: number; inss: number; irrf: number; fgts: number };
  itens: ReturnType<typeof colaborador>[];
  pendencias: { funcionarioId: number; nome: string; motivo: string }[];
}

type Chamada = { metodo: string; caminho: string; corpo?: Record<string, unknown> };

let server: ViteDevServer;
let Payroll: ComponentType;
let Payslips: ComponentType;
let Company: ComponentType;
let AuthProvider: ComponentType<{ children?: unknown }>;
let UiProviders: ComponentType<{ children?: unknown }>;
const originalFetch = globalThis.fetch;

let chamadas: Chamada[] = [];
let folhas: Record<string, FolhaDoServidor> = {};
let pendenciasDoProcessamento: FolhaDoServidor['pendencias'] = [];
let perfil: 'Administrador' | 'RH' | 'Colaborador' = 'RH';
let empresa = { nome: 'Empresa Ficticia Alfa', razao_social: null as string | null, cnpj: null as string | null, regime_tributario: null as string | null };
let respostaDoSalvamento: { status: number; corpo: unknown } | null = null;
let meusHolerites: unknown[] = [];
let montados: { host: HTMLElement; root: Root }[] = [];

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

const totaisDe = (itens: FolhaDoServidor['itens']) => ({
  bruto: itens.reduce((t, i) => t + i.totalGross, 0),
  descontos: itens.reduce((t, i) => t + i.totalDeductions, 0),
  liquido: itens.reduce((t, i) => t + i.netSalary, 0),
  encargos: itens.reduce((t, i) => t + i.employerCharges, 0),
  inss: itens.reduce((t, i) => t + i.inss, 0),
  irrf: itens.reduce((t, i) => t + i.irrf, 0),
  fgts: itens.reduce((t, i) => t + i.fgts, 0),
});

before(async () => {
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ default: Payroll } = await server.ssrLoadModule('/src/pages/Admin/Payroll.tsx'));
  ({ default: Payslips } = await server.ssrLoadModule('/src/pages/Portal/Payslips.tsx'));
  ({ default: Company } = await server.ssrLoadModule('/src/pages/Admin/Company.tsx'));
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = String(entrada).replace(/^\/api/, '');
    const metodo = (init?.method ?? 'GET').toUpperCase();
    chamadas.push({ metodo, caminho, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });

    if (caminho === '/auth/sessao') return json(200, { id: 1, nome: 'Rita Teste', perfil, empresa_nome: 'Empresa Ficticia Alfa', funcionario_id: perfil === 'Colaborador' ? 7 : null });
    if (caminho === '/folha/meus-holerites') return json(200, meusHolerites);
    if (caminho === '/empresa' && metodo === 'GET') return json(200, empresa);
    if (caminho === '/empresa' && metodo === 'PUT') {
      const resposta = respostaDoSalvamento ?? { status: 200, corpo: { ...empresa, razao_social: 'x' } };
      return json(resposta.status, resposta.corpo);
    }

    const [, competencia, acao] = /^\/folha\/competencias\/(\d{4}-\d{2})(?:\/(\w+))?$/.exec(caminho) ?? [];
    if (!competencia) return json(404, { erro: 'rota inesperada no teste' });
    const folha = folhas[competencia];
    if (metodo === 'GET') return folha ? json(200, folha) : json(404, { erro: `A folha de ${competencia} ainda não foi processada.` });
    if (acao === 'processar') {
      if (folha?.status === 'fechada') return json(409, { erro: 'A folha está fechada e não pode ser processada de novo.' });
      const itens = [ANA, PAULO];
      folhas[competencia] = { competencia, status: 'aberta', processadaEm: '2026-10-02T15:00:00.000Z', fechadaEm: null, empresa: EMPRESA, regimeTributario: 'Simples Nacional', totais: totaisDe(itens), itens, pendencias: pendenciasDoProcessamento };
      return json(folha ? 200 : 201, folhas[competencia]);
    }
    if (acao === 'fechar' && folha) {
      folhas[competencia] = { ...folha, status: 'fechada', fechadaEm: '2026-10-05T18:30:00.000Z' };
      return json(200, folhas[competencia]);
    }
    return json(404, { erro: 'rota inesperada no teste' });
  }) as typeof fetch;
});

// O AuthProvider abre um BroadcastChannel: sem desmontar, o Node não encerra o processo.
const desmontar = async () => {
  for (const { root, host } of montados) { await act(async () => root.unmount()); host.remove(); }
  montados = [];
};

after(async () => {
  await desmontar();
  globalThis.fetch = originalFetch;
  await server.close();
  dom.window.close();
});

beforeEach(async () => {
  await desmontar();
  chamadas = [];
  folhas = {};
  pendenciasDoProcessamento = [];
  perfil = 'RH';
  respostaDoSalvamento = null;
  meusHolerites = [];
  empresa = { nome: 'Empresa Ficticia Alfa', razao_social: null, cnpj: null, regime_tributario: null };
  document.cookie = 'hrflow_csrf=teste';
});

const esperar = (ms = 0) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

const montar = async (Tela: ComponentType) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  montados.push({ host, root });
  const cliente = novoQueryClient();
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: cliente },
      createElement(MemoryRouter, null, createElement(AuthProvider, null, createElement(UiProviders, null, createElement(Tela))))));
  });
  await esperar(50);
  return host;
};

const clicar = async (elemento: Element) => {
  await act(async () => { elemento.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
  await esperar();
};

const botao = (host: ParentNode, texto: RegExp) => {
  const encontrado = [...host.querySelectorAll('button')].find((candidato) => texto.test(candidato.textContent ?? '') || texto.test(candidato.getAttribute('aria-label') ?? ''));
  assert.ok(encontrado, `botão ${texto} não está na tela`);
  return encontrado;
};

const semBotao = (host: ParentNode, texto: RegExp) =>
  assert.ok(![...host.querySelectorAll('button')].some((candidato) => texto.test(candidato.textContent ?? '')), `botão ${texto} não deveria estar na tela`);

const digitar = async (elemento: HTMLInputElement, valor: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(elemento, valor);
    elemento.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await esperar();
};

const texto = (host: HTMLElement) => (host.textContent ?? '').replace(/\s+/g, ' ');

test('competência sem folha: avisa, oferece processar e, ao processar, mostra a folha aberta', async () => {
  const host = await montar(Payroll);
  assert.match(texto(host), /A folha de .* ainda não foi processada/);
  assert.deepEqual(chamadas.filter((c) => c.caminho.startsWith('/folha')).map((c) => `${c.metodo} ${c.caminho}`), [`GET /folha/competencias/${MES}`]);
  semBotao(host, /Fechar mês/);

  await clicar(botao(host, /Processar folha/));
  assert.ok(chamadas.some((c) => c.metodo === 'POST' && c.caminho === `/folha/competencias/${MES}/processar`));
  const depois = texto(host);
  assert.match(depois, /Folha aberta/);
  assert.match(depois, /Ana Souza Ficticia/);
  assert.match(depois, /Paulo Pj Ficticio/);
  assert.match(depois, /Processada em 02\/10\/2026 às 12:00/);
  botao(host, /Fechar mês/);
  botao(host, /Processar novamente/);
});

test('o contrato aparece na linha do colaborador e o PJ não tem desconto', async () => {
  folhas[MES] = { competencia: MES, status: 'aberta', processadaEm: '2026-10-02T15:00:00.000Z', fechadaEm: null, empresa: EMPRESA, regimeTributario: 'Simples Nacional', totais: totaisDe([ANA, PAULO]), itens: [ANA, PAULO], pendencias: [] };
  const host = await montar(Payroll);
  const linhas = [...host.querySelectorAll('tbody tr')].map((linha) => texto(linha as HTMLElement));
  assert.match(linhas[0], /Ana Souza Ficticia.*Analista · CLT.*R\$ 236,69/);
  assert.match(linhas[1], /Paulo Pj Ficticio.*Analista · PJ.*R\$ 0,00/);
});

test('fechar o mês pede confirmação e só então chama a API; depois a folha fica travada', async () => {
  folhas[MES] = { competencia: MES, status: 'aberta', processadaEm: '2026-10-02T15:00:00.000Z', fechadaEm: null, empresa: EMPRESA, regimeTributario: 'Simples Nacional', totais: totaisDe([ANA]), itens: [ANA], pendencias: [] };
  const host = await montar(Payroll);

  // A confirmação é um diálogo (portal no <body>), não parte da página.
  await clicar(botao(host, /Fechar mês/));
  assert.match(texto(document.body.querySelector('[role="dialog"]') as HTMLElement), /Fechar a folha de .*\?/);
  assert.equal(chamadas.filter((c) => c.metodo === 'POST').length, 0, 'só abrir a confirmação não fecha nada');

  await clicar(botao(document.body.querySelector('[role="dialog"]')!, /Cancelar/));
  assert.equal(document.body.querySelector('[role="dialog"]'), null);
  assert.equal(chamadas.filter((c) => c.metodo === 'POST').length, 0);

  await clicar(botao(host, /Fechar mês/));
  await clicar(botao(document.body.querySelector('[role="dialog"]')!, /Confirmar fechamento/));
  assert.deepEqual(chamadas.filter((c) => c.metodo === 'POST').map((c) => c.caminho), [`/folha/competencias/${MES}/fechar`]);
  const depois = texto(host);
  assert.match(depois, /Folha fechada/);
  assert.match(depois, /Fechada em 05\/10\/2026 às 15:30/);
  semBotao(host, /Fechar mês/);
  semBotao(host, /Processar novamente/);
});

test('folha fechada não oferece processar nem fechar', async () => {
  folhas[MES] = { competencia: MES, status: 'fechada', processadaEm: '2026-10-02T15:00:00.000Z', fechadaEm: '2026-10-05T18:30:00.000Z', empresa: EMPRESA, regimeTributario: 'Simples Nacional', totais: totaisDe([ANA]), itens: [ANA], pendencias: [] };
  const host = await montar(Payroll);
  assert.match(texto(host), /Folha fechada/);
  semBotao(host, /Fechar mês/);
  semBotao(host, /Processar/);
});

test('uma recusa da API (empresa sem CNPJ) aparece na tela e a folha continua aberta', async () => {
  folhas[MES] = { competencia: MES, status: 'aberta', processadaEm: '2026-10-02T15:00:00.000Z', fechadaEm: null, empresa: { razaoSocial: null, cnpj: null }, regimeTributario: 'Simples Nacional', totais: totaisDe([ANA]), itens: [ANA], pendencias: [] };
  const original = globalThis.fetch;
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    if (String(entrada).endsWith('/fechar')) return json(422, { erro: 'Preencha a razão social e o CNPJ da empresa antes de fechar a folha: eles aparecem no holerite.' });
    return original(entrada, init);
  }) as typeof fetch;
  try {
    const host = await montar(Payroll);
    await clicar(botao(host, /Fechar mês/));
    await clicar(botao(document.body.querySelector('[role="dialog"]')!, /Confirmar fechamento/));
    assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /Preencha a razão social e o CNPJ/);
    assert.match(texto(host), /Folha aberta/);
  } finally {
    globalThis.fetch = original;
  }
});

test('colaboradores sem salário aparecem em pendências, e o aviso de fechamento as cita', async () => {
  folhas[MES] = {
    competencia: MES, status: 'aberta', processadaEm: '2026-10-02T15:00:00.000Z', fechadaEm: null, empresa: EMPRESA, regimeTributario: 'Simples Nacional', totais: totaisDe([ANA]), itens: [ANA],
    pendencias: [{ funcionarioId: 9, nome: 'Sem Salario Ficticio', motivo: 'Salário base não informado' }],
  };
  const host = await montar(Payroll);
  const painel = texto(host);
  assert.match(painel, /Pendências \(1\)/);
  assert.match(painel, /Sem Salario Ficticio.*Salário base não informado/);
  assert.doesNotMatch([...host.querySelectorAll('tbody')].map((t) => t.textContent).join(' '), /Sem Salario/);

  await clicar(botao(host, /Fechar mês/));
  assert.match(texto(document.body.querySelector('[role="dialog"]') as HTMLElement), /1 colaborador\(es\) sem salário ficarão sem holerite neste mês/);
});

test('escolher outra competência busca a folha daquele mês', async () => {
  folhas['2026-08'] = { competencia: '2026-08', status: 'fechada', processadaEm: '2026-08-02T15:00:00.000Z', fechadaEm: '2026-08-05T18:30:00.000Z', empresa: EMPRESA, regimeTributario: 'Simples Nacional', totais: totaisDe([PAULO]), itens: [PAULO], pendencias: [] };
  const host = await montar(Payroll);
  assert.match(texto(host), /ainda não foi processada/);

  await digitar(host.querySelector<HTMLInputElement>('input[type="month"]')!, '2026-08');
  assert.ok(chamadas.some((c) => c.caminho === '/folha/competencias/2026-08'));
  const depois = texto(host);
  assert.match(depois, /Folha de agosto de 2026/);
  assert.match(depois, /Paulo Pj Ficticio/);
  assert.match(depois, /Folha fechada/);
});

test('o seletor de competência não deixa escolher um mês que ainda não começou', async () => {
  const host = await montar(Payroll);
  assert.equal(host.querySelector<HTMLInputElement>('input[type="month"]')!.max, MES);
});

test('o holerite aberto pelo RH mostra razão social, CNPJ e a competência da folha', async () => {
  folhas['2026-08'] = { competencia: '2026-08', status: 'fechada', processadaEm: '2026-08-02T15:00:00.000Z', fechadaEm: '2026-08-05T18:30:00.000Z', empresa: EMPRESA, regimeTributario: 'Simples Nacional', totais: totaisDe([ANA]), itens: [ANA], pendencias: [] };
  const host = await montar(Payroll);
  await digitar(host.querySelector<HTMLInputElement>('input[type="month"]')!, '2026-08');
  await clicar(botao(host.querySelector('tbody tr')!, /Ver holerite/));
  const modal = texto(document.body.querySelector('.holerite-impressao') as HTMLElement);
  assert.match(modal, /Empresa Ficticia Alfa Ltda/);
  assert.match(modal, /CNPJ: 11\.222\.333\/0001-81/);
  assert.match(modal, /Referência: agosto de 2026/);
  assert.match(modal, /Ana Souza Ficticia/);
});

test('o colaborador vê um holerite por mês fechado, com a empresa e o CNPJ de cada mês', async () => {
  perfil = 'Colaborador';
  meusHolerites = [
    { ...ANA, competencia: '2026-09', empresa: EMPRESA },
    { ...ANA, baseSalary: 2500, totalGross: 2500, netSalary: 2500 - 187.5, totalDeductions: 187.5, competencia: '2026-08', empresa: { razaoSocial: 'Razao Antiga Ltda', cnpj: '11222333000181' } },
  ];
  const host = await montar(Payslips);
  const linhas = [...host.querySelectorAll('tbody tr')].map((linha) => texto(linha as HTMLElement));
  assert.equal(linhas.length, 2);
  assert.match(linhas[0], /setembro de 2026.*R\$ 2\.900,00/);
  assert.match(linhas[1], /agosto de 2026.*R\$ 2\.500,00/);
  assert.match(texto(host), /Último bruto \(setembro de 2026\)/);

  await clicar(botao(host.querySelectorAll('tbody tr')[1], /Visualizar/));
  const modal = texto(document.body.querySelector('.holerite-impressao') as HTMLElement);
  assert.match(modal, /Referência: agosto de 2026/);
  assert.match(modal, /Razao Antiga Ltda/);
  assert.match(modal, /CNPJ: 11\.222\.333\/0001-81/);
});

test('o colaborador sem folha fechada vê a explicação, não uma tabela vazia', async () => {
  perfil = 'Colaborador';
  const host = await montar(Payslips);
  assert.match(texto(host), /Nenhum holerite disponível/);
  assert.match(texto(host), /quando o RH fechar a folha do mês/);
  assert.equal(host.querySelectorAll('tbody tr').length, 0);
});

test('o Administrador preenche razão social e CNPJ com máscara e salva', async () => {
  perfil = 'Administrador';
  empresa = { nome: 'Empresa Ficticia Alfa', razao_social: null, cnpj: null, regime_tributario: null };
  respostaDoSalvamento = { status: 200, corpo: { nome: 'Empresa Ficticia Alfa', razao_social: 'Empresa Ficticia Alfa Ltda', cnpj: '11222333000181', regime_tributario: 'Simples Nacional' } };
  const host = await montar(Company);
  assert.match(texto(host), /Empresa Ficticia Alfa/);

  await digitar(host.querySelector<HTMLInputElement>('[name="razaoSocial"]')!, 'Empresa Ficticia Alfa Ltda');
  await digitar(host.querySelector<HTMLInputElement>('[name="cnpj"]')!, '11222333000181');
  assert.equal(host.querySelector<HTMLInputElement>('[name="cnpj"]')!.value, '11.222.333/0001-81');
  await act(async () => {
    const select = host.querySelector<HTMLSelectElement>('[name="regime"]')!;
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!.call(select, 'Simples Nacional');
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await act(async () => { host.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await esperar();

  const envio = chamadas.find((c) => c.metodo === 'PUT');
  assert.deepEqual(envio?.corpo, { razao_social: 'Empresa Ficticia Alfa Ltda', cnpj: '11.222.333/0001-81', regime_tributario: 'Simples Nacional' });
  assert.match(texto(host), /Dados da empresa salvos/);
  assert.equal(host.querySelector<HTMLInputElement>('[name="cnpj"]')!.value, '11.222.333/0001-81');
});

test('a recusa da API (CNPJ inválido) aparece sem fingir que salvou', async () => {
  perfil = 'Administrador';
  respostaDoSalvamento = { status: 400, corpo: { erro: 'CNPJ inválido: confira os 14 dígitos.' } };
  const host = await montar(Company);
  await digitar(host.querySelector<HTMLInputElement>('[name="razaoSocial"]')!, 'Empresa Ficticia Alfa Ltda');
  await digitar(host.querySelector<HTMLInputElement>('[name="cnpj"]')!, '11222333000182');
  await act(async () => { host.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await esperar();
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /CNPJ inválido/);
  assert.doesNotMatch(texto(host), /Dados da empresa salvos/);
});

test('o RH consulta os dados da empresa mas não os altera', async () => {
  perfil = 'RH';
  empresa = { nome: 'Empresa Ficticia Alfa', razao_social: 'Empresa Ficticia Alfa Ltda', cnpj: '11222333000181', regime_tributario: 'Lucro Real' };
  const host = await montar(Company);
  assert.equal(host.querySelector<HTMLInputElement>('[name="razaoSocial"]')!.value, 'Empresa Ficticia Alfa Ltda');
  assert.equal(host.querySelector<HTMLInputElement>('[name="cnpj"]')!.value, '11.222.333/0001-81');
  assert.equal(host.querySelector<HTMLInputElement>('[name="razaoSocial"]')!.disabled, true);
  assert.equal(host.querySelector<HTMLInputElement>('[name="cnpj"]')!.disabled, true);
  assert.match(texto(host), /Somente o Administrador altera/);
  semBotao(host, /Salvar/);
});
