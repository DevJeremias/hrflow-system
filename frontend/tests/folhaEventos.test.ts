// IRRF, FGTS, lançamentos por colaborador e holerite em PDF na interface (B-21): o RH baixa o PDF da folha
// e o de cada colaborador, lança adiantamento, VT, VR e plano de saúde, cuida dos dependentes do IRRF, e o
// colaborador baixa o próprio holerite. A API é simulada com o estado mínimo para exercitar as telas de verdade.
import { after, afterEach, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { act, botaoPorTexto, clicar, createElement, desmontarTudo, dom, esperar, iniciarVite, montar, porRole } from './support/ui.ts';
import { novoQueryClient } from './support/consulta.ts';
import { json, type Chamada } from './support/apiAdmin.ts';
import type { ComponentType } from 'react';
import type { ViteDevServer } from 'vite';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });

const COMPETENCIA = '2026-10';
const EMPRESA = { razaoSocial: 'Empresa Ficticia Alfa Ltda', cnpj: '11222333000181' };
const SEM_LANCAMENTOS = { adiantamento: 0, valeTransporte: 0, valeRefeicao: 0, planoSaude: 0 };

const ANA = {
  id: '7', name: 'Ana Souza Ficticia', role: 'Analista', department: 'Tecnologia', contract: 'CLT',
  baseSalary: 6800, totalEarnings: 60, totalDeductions: 1567.66, totalGross: 6860, netSalary: 5292.34, employerCharges: 2451.08,
  inss: 756.7, irrf: 677.03, fgts: 548.8, dependents: 0,
  bases: { inss: 6860, fgts: 6860, irrf: 6103.3 }, lancamentos: SEM_LANCAMENTOS,
  earningsList: [{ description: 'Horas extras 50%', value: 60, isPercentage: false, reference: '02:00' }],
  deductionsList: [
    { description: 'Faltas', value: 133.93, isPercentage: false, reference: '1 dia' },
    { description: 'Desconto INSS', value: 756.7, isPercentage: false, reference: null },
    { description: 'IRRF', value: 677.03, isPercentage: false, reference: null },
  ],
  chargesList: [{ description: 'FGTS', value: 548.8, isPercentage: false, reference: '8%' }],
};
const PAULO = {
  ...ANA, id: '8', name: 'Paulo Pj Ficticio', contract: 'PJ', baseSalary: 3000, totalEarnings: 0, totalDeductions: 0, totalGross: 3000, netSalary: 3000,
  employerCharges: 0, inss: 0, irrf: 0, fgts: 0, bases: null, earningsList: [], deductionsList: [], chargesList: [],
};

const folhaDe = (status: 'aberta' | 'fechada', regimeTributario: string | null = 'Simples Nacional') => ({
  competencia: COMPETENCIA, status, processadaEm: '2026-10-02T15:00:00.000Z', fechadaEm: status === 'fechada' ? '2026-10-05T18:30:00.000Z' : null,
  empresa: EMPRESA, regimeTributario,
  totais: { bruto: 9860, descontos: 1567.66, liquido: 8292.34, encargos: 2451.08, inss: 756.7, irrf: 677.03, fgts: 548.8 },
  itens: [ANA, PAULO], pendencias: [],
});

let server: ViteDevServer;
let Payroll: ComponentType;
let Payslips: ComponentType;
let AuthProvider: ComponentType<{ children?: unknown }>;
let UiProviders: ComponentType<{ children?: unknown }>;
const originalFetch = globalThis.fetch;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalAnchorClick = dom.window.HTMLAnchorElement.prototype.click;

let chamadas: Chamada[] = [];
let folha = folhaDe('aberta');
let perfil: 'RH' | 'Colaborador' = 'RH';
let dependentes: { id: number; nome: string; parentesco: string; data_nascimento: string | null }[] = [];
let recusa: { status: number; corpo: unknown } | null = null;
let baixados: string[] = [];
let meusHolerites: unknown[] = [];

const pdf = (nome: string) => new Response(new Blob(['%PDF-1.3 fictício']), { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nome}"` } });

before(async () => {
  server = await iniciarVite();
  ({ default: Payroll } = await server.ssrLoadModule('/src/pages/Admin/Payroll.tsx'));
  ({ default: Payslips } = await server.ssrLoadModule('/src/pages/Portal/Payslips.tsx'));
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  // O jsdom não tem URL.createObjectURL nem navega num <a download>: o teste só anota o nome do arquivo.
  URL.createObjectURL = () => 'blob:fake';
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) { baixados.push(this.download); };

  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = String(entrada).replace(/^\/api/, '');
    const metodo = (init?.method ?? 'GET').toUpperCase();
    chamadas.push({ metodo, caminho, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });

    if (caminho === '/auth/sessao') return json(200, { id: 1, nome: 'Rita Teste', perfil, empresa_nome: 'Empresa Ficticia Alfa', funcionario_id: perfil === 'Colaborador' ? 7 : null });
    if (caminho === '/folha/meus-holerites') return json(200, meusHolerites);
    if (caminho.includes('.pdf')) {
      if (recusa) return json(recusa.status, recusa.corpo);
      return pdf(caminho.includes('/holerites/') ? 'holerite-2026-10-ana-souza-ficticia.pdf' : caminho.includes('meu-holerite') ? 'holerite-2026-09.pdf' : 'holerites-2026-10.pdf');
    }
    if (caminho === `/folha/competencias/${COMPETENCIA}` && metodo === 'GET') return json(200, folha);
    if (/^\/folha\/competencias\/[\d-]+\/lancamentos\/\d+$/.test(caminho) && metodo === 'PUT') {
      if (recusa) return json(recusa.status, recusa.corpo);
      const lancamentos = JSON.parse(String(init!.body));
      const atualizado = { ...ANA, lancamentos };
      folha = { ...folha, itens: [atualizado, PAULO] };
      return json(200, atualizado);
    }
    const dependente = /^\/funcionarios\/(\d+)\/dependentes(?:\/(\d+))?$/.exec(caminho);
    if (dependente) {
      if (metodo === 'GET') return json(200, dependentes);
      if (recusa) return json(recusa.status, recusa.corpo);
      if (metodo === 'POST') {
        const novo = { id: 100 + dependentes.length, ...JSON.parse(String(init!.body)) };
        dependentes = [...dependentes, novo];
        return json(201, novo);
      }
      dependentes = dependentes.filter((d) => d.id !== Number(dependente[2]));
      return new Response(null, { status: 204 });
    }
    return json(404, { erro: `rota inesperada no teste: ${metodo} ${caminho}` });
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = originalFetch;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  dom.window.HTMLAnchorElement.prototype.click = originalAnchorClick;
  await server.close();
  dom.window.close();
});

beforeEach(() => {
  chamadas = [];
  folha = folhaDe('aberta');
  perfil = 'RH';
  dependentes = [];
  recusa = null;
  baixados = [];
  meusHolerites = [];
  document.cookie = 'hrflow_csrf=teste';
});
afterEach(desmontarTudo);

const abrir = async (Tela: ComponentType) => {
  const host = await montar(createElement(QueryClientProvider, { client: novoQueryClient() },
    createElement(MemoryRouter, null, createElement(AuthProvider, null, createElement(UiProviders, null, createElement(Tela))))));
  await esperar(50);
  return host;
};

const texto = (raiz: ParentNode) => ((raiz as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
const digitar = async (campo: HTMLInputElement | HTMLSelectElement, valor: string) => {
  const prototipo = campo instanceof dom.window.HTMLSelectElement ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototipo, 'value')!.set!.call(campo, valor);
    campo.dispatchEvent(new dom.window.Event(campo instanceof dom.window.HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
};
const enviar = async (formulario: Element) => {
  await act(async () => { formulario.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await esperar(20);
};
const campo = (raiz: ParentNode, nome: string) => raiz.querySelector<HTMLInputElement>(`[name="${nome}"]`)!;
const dialogo = () => porRole(document, 'dialog')!;

test('as retenções somam INSS e IRRF e os encargos somam FGTS e contribuições patronais', async () => {
  const host = await abrir(Payroll);
  const painel = texto(host);
  assert.match(painel, /Retenções \(INSS\/IRRF\)\s*R\$ 1\.433,73/, 'INSS 756,70 + IRRF 677,03, sem os descontos de benefício nem a falta');
  assert.match(painel, /Encargos Empresa \(FGTS e patronais\)\s*R\$ 2\.451,08/);
  assert.doesNotMatch(painel, /Estimado/);
});

test('o aviso de regime tributário só aparece com a folha aberta e o regime em branco', async () => {
  folha = folhaDe('aberta', null);
  assert.match(texto(await abrir(Payroll)), /O regime tributário da empresa não foi informado/);
  await desmontarTudo();
  folha = folhaDe('aberta', 'Lucro Presumido');
  assert.doesNotMatch(texto(await abrir(Payroll)), /regime tributário da empresa não foi informado/);
  await desmontarTudo();
  folha = folhaDe('fechada', null);
  assert.doesNotMatch(texto(await abrir(Payroll)), /regime tributário da empresa não foi informado/);
});

test('"Baixar PDF dos holerites" pede o PDF da competência e entrega o arquivo com o nome do servidor', async () => {
  const host = await abrir(Payroll);
  await clicar(botaoPorTexto(host, /Baixar PDF dos holerites/));
  await esperar(20);
  assert.ok(chamadas.some((c) => c.metodo === 'GET' && c.caminho === `/folha/competencias/${COMPETENCIA}/holerites.pdf`));
  assert.deepEqual(baixados, ['holerites-2026-10.pdf']);
});

test('a folha fechada também oferece o PDF em lote, e a sem holerites não', async () => {
  folha = folhaDe('fechada');
  assert.ok(botaoPorTexto(await abrir(Payroll), /Baixar PDF dos holerites/));
  await desmontarTudo();
  folha = { ...folhaDe('aberta'), itens: [] };
  const vazia = await abrir(Payroll);
  assert.equal([...vazia.querySelectorAll('button')].some((b) => /Baixar PDF dos holerites/.test(b.textContent ?? '')), false);
});

test('cada linha tem o PDF do colaborador', async () => {
  const host = await abrir(Payroll);
  await clicar(botaoPorTexto(host, /Baixar PDF do holerite de Ana Souza Ficticia/));
  await esperar(20);
  assert.ok(chamadas.some((c) => c.caminho === `/folha/competencias/${COMPETENCIA}/holerites/7.pdf`));
  assert.deepEqual(baixados, ['holerite-2026-10-ana-souza-ficticia.pdf']);
});

test('uma recusa ao gerar o PDF aparece num aviso e nada é baixado', async () => {
  recusa = { status: 404, corpo: { erro: 'Este colaborador não tem holerite na folha de 10/2026.' } };
  const host = await abrir(Payroll);
  await clicar(botaoPorTexto(host, /Baixar PDF dos holerites/));
  await esperar(20);
  assert.match(texto(document.body), /Este colaborador não tem holerite na folha de 10\/2026\./);
  assert.deepEqual(baixados, []);
});

test('o holerite aberto mostra o IRRF, as referências, o FGTS do mês, as bases e os dependentes, e baixa o PDF', async () => {
  const host = await abrir(Payroll);
  await clicar(botaoPorTexto(host.querySelector('tbody tr')!, /Ver holerite/));
  const modal = texto(document.body.querySelector('.holerite-impressao') as HTMLElement);
  for (const esperado of [/IRRF/, /Horas extras 50%\s*02:00/, /Faltas\s*1 dia/, /Base INSS\s*R\$ 6\.860,00/, /Base FGTS\s*R\$ 6\.860,00/, /FGTS do mês\s*R\$ 548,80/, /Base IRRF\s*R\$ 6\.103,30/, /Dependentes IRRF\s*0/]) {
    assert.match(modal, esperado);
  }
  assert.match(modal, /Total de Descontos\s*R\$ 1\.567,66/);
  await clicar(botaoPorTexto(dialogo(), /Baixar PDF/));
  await esperar(20);
  assert.deepEqual(baixados, ['holerite-2026-10-ana-souza-ficticia.pdf']);
});

test('o holerite sem bases (emitido antes do IRRF) não mostra o bloco de bases', async () => {
  const host = await abrir(Payroll);
  await clicar(botaoPorTexto(host.querySelectorAll('tbody tr')[1], /Ver holerite/));
  const modal = texto(document.body.querySelector('.holerite-impressao') as HTMLElement);
  assert.doesNotMatch(modal, /Base INSS/);
  assert.match(modal, /Paulo Pj Ficticio/);
});

test('os lançamentos do colaborador: mostra o que veio do ponto, salva os quatro valores e recarrega a folha', async () => {
  const host = await abrir(Payroll);
  await clicar(botaoPorTexto(host, /Lançamentos de Ana Souza Ficticia/));
  const modal = dialogo();
  assert.match(texto(modal), /Lançamentos de Ana Souza Ficticia/);
  assert.match(texto(modal), /Vindo do ponto/);
  assert.match(texto(modal), /Horas extras 50% \(02:00\)\s*\+ R\$ 60,00/);
  assert.match(texto(modal), /Faltas \(1 dia\)\s*- R\$ 133,93/);
  assert.match(texto(modal), /desconto é o menor entre este custo e 6% do salário \(R\$ 408,00\)/);

  await digitar(campo(modal, 'adiantamento'), '300');
  await digitar(campo(modal, 'valeTransporte'), '500.5');
  const antes = chamadas.length;
  await enviar(botaoPorTexto(modal, /Salvar lançamentos/).closest('form')!);

  const gravacao = chamadas.slice(antes).find((c) => c.metodo === 'PUT');
  assert.equal(gravacao?.caminho, `/folha/competencias/${COMPETENCIA}/lancamentos/7`);
  assert.deepEqual(gravacao?.corpo, { adiantamento: 300, valeTransporte: 500.5, valeRefeicao: 0, planoSaude: 0 });
  assert.ok(chamadas.slice(antes).some((c) => c.metodo === 'GET' && c.caminho === `/folha/competencias/${COMPETENCIA}`), 'a folha é lida de novo');
  assert.equal(porRole(document, 'dialog'), null, 'o modal fecha ao salvar');
  assert.match(texto(document.body), /Lançamentos de Ana Souza Ficticia salvos: o holerite de outubro de 2026 foi recalculado\./);

  // Reaberto, já traz o que foi lançado.
  await clicar(botaoPorTexto(host, /Lançamentos de Ana Souza Ficticia/));
  assert.equal(campo(dialogo(), 'adiantamento').value, '300');
  assert.equal(campo(dialogo(), 'valeTransporte').value, '500.5');
  assert.equal(campo(dialogo(), 'planoSaude').value, '');
});

test('uma recusa da API ao salvar os lançamentos aparece no modal, que continua aberto', async () => {
  const host = await abrir(Payroll);
  await clicar(botaoPorTexto(host, /Lançamentos de Ana Souza Ficticia/));
  recusa = { status: 400, corpo: { erro: 'Os descontos superam os proventos do mês.' } };
  await digitar(campo(dialogo(), 'adiantamento'), '99999');
  await enviar(botaoPorTexto(dialogo(), /Salvar lançamentos/).closest('form')!);
  assert.match(dialogo().querySelector('[role="alert"]')?.textContent ?? '', /Os descontos superam os proventos do mês/);
  assert.equal(campo(dialogo(), 'adiantamento').value, '99999');
});

test('valor negativo é recusado antes de chamar a API', async () => {
  const host = await abrir(Payroll);
  await clicar(botaoPorTexto(host, /Lançamentos de Ana Souza Ficticia/));
  await digitar(campo(dialogo(), 'planoSaude'), '-5');
  const antes = chamadas.length;
  await enviar(botaoPorTexto(dialogo(), /Salvar lançamentos/).closest('form')!);
  assert.match(dialogo().querySelector('[role="alert"]')?.textContent ?? '', /valores a partir de zero/);
  assert.equal(chamadas.slice(antes).some((c) => c.metodo === 'PUT'), false);
});

test('com a folha fechada os lançamentos só se leem', async () => {
  folha = folhaDe('fechada');
  folha.itens = [{ ...ANA, lancamentos: { ...SEM_LANCAMENTOS, adiantamento: 300 } }, PAULO];
  const host = await abrir(Payroll);
  await clicar(botaoPorTexto(host, /Lançamentos de Ana Souza Ficticia/));
  const modal = dialogo();
  assert.match(texto(modal), /fechada: os lançamentos não podem mais mudar/);
  for (const nome of ['adiantamento', 'valeTransporte', 'valeRefeicao', 'planoSaude']) assert.equal(campo(modal, nome).disabled, true, nome);
  assert.equal(campo(modal, 'adiantamento').value, '300');
  assert.equal([...modal.querySelectorAll('button')].some((b) => /Salvar lançamentos/.test(b.textContent ?? '')), false);
});

test('dependentes: lista, adiciona e remove, e explica que valem ao processar de novo', async () => {
  dependentes = [{ id: 1, nome: 'Filha Ficticia', parentesco: 'Filho(a)', data_nascimento: '2018-05-20' }];
  const host = await abrir(Payroll);
  await clicar(botaoPorTexto(host, /Lançamentos de Ana Souza Ficticia/));
  await esperar(20);
  const modal = dialogo();
  assert.match(texto(modal), /Cada dependente reduz a base do IRRF em R\$ 189,59/);
  assert.match(texto(modal), /Filha Ficticia\s*Filho\(a\) · nascido em 20\/05\/2018/);

  await digitar(campo(modal, 'dependenteNome'), 'Esposo Ficticio');
  await digitar(modal.querySelector<HTMLSelectElement>('select[name="dependenteParentesco"]')!, 'Cônjuge');
  await enviar(modal.querySelector('form[aria-label="Novo dependente"]')!);
  const criado = chamadas.find((c) => c.metodo === 'POST');
  assert.equal(criado?.caminho, '/funcionarios/7/dependentes');
  assert.deepEqual(criado?.corpo, { nome: 'Esposo Ficticio', parentesco: 'Cônjuge', data_nascimento: null });
  assert.match(texto(modal), /Esposo Ficticio\s*Cônjuge/);
  assert.equal(campo(modal, 'dependenteNome').value, '', 'o formulário limpa depois de cadastrar');

  await clicar(botaoPorTexto(modal, /Remover dependente Filha Ficticia/));
  await esperar(20);
  assert.ok(chamadas.some((c) => c.metodo === 'DELETE' && c.caminho === '/funcionarios/7/dependentes/1'));
  assert.doesNotMatch(texto(modal), /Filha Ficticia/);
});

test('dependente de um cadastro que o RH não alcança: a recusa da API aparece no modal', async () => {
  const host = await abrir(Payroll);
  await clicar(botaoPorTexto(host, /Lançamentos de Ana Souza Ficticia/));
  await esperar(20);
  recusa = { status: 403, corpo: { erro: 'Você não pode alterar o seu próprio cadastro. Peça a um Administrador.' } };
  await digitar(campo(dialogo(), 'dependenteNome'), 'Alguem Ficticio');
  await enviar(dialogo().querySelector('form[aria-label="Novo dependente"]')!);
  assert.match(dialogo().querySelector('[role="alert"]')?.textContent ?? '', /Você não pode alterar o seu próprio cadastro/);
  assert.match(campo(dialogo(), 'dependenteNome').value, /Alguem Ficticio/, 'o que foi digitado fica');
});

test('o colaborador baixa o PDF do próprio holerite, na lista e dentro do holerite aberto', async () => {
  perfil = 'Colaborador';
  meusHolerites = [{ ...ANA, competencia: '2026-09', empresa: EMPRESA }];
  const host = await abrir(Payslips);
  await clicar(botaoPorTexto(host, /Baixar PDF do holerite de setembro de 2026/));
  await esperar(20);
  assert.ok(chamadas.some((c) => c.caminho === '/folha/meu-holerite.pdf?competencia=2026-09'));
  assert.deepEqual(baixados, ['holerite-2026-09.pdf']);

  await clicar(botaoPorTexto(host, /Visualizar holerite de setembro de 2026/));
  await clicar(botaoPorTexto(dialogo(), /Baixar PDF/));
  await esperar(20);
  assert.equal(baixados.length, 2);
});
