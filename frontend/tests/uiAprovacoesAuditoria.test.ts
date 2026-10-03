// B-22: as telas de Aprovações (pedidos de alteração cadastral) e de Auditoria (trilha e histórico contratual).
// Montadas com o Vite e uma API falsa; o que importa é o que a gestão lê, o que ela envia e o que cada botão diz.
import { after, afterEach, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { act, botaoPorTexto, clicar, createElement, desmontarTudo, dom, esperar, iniciarVite, montar, porRole } from './support/ui.ts';
import { novoQueryClient } from './support/consulta.ts';
import type { ComponentType } from 'react';
import type { ViteDevServer } from 'vite';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });

let server: ViteDevServer;
let Approvals: ComponentType;
let Audit: ComponentType;
let UiProviders: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;

interface Chamada { metodo: string; caminho: string; corpo?: Record<string, unknown> }
let chamadas: Chamada[] = [];
let pedidos: unknown[] = [];
let decisao: () => Response;

const json = (corpo: unknown, status = 200, cabecalhos: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', ...cabecalhos } });

const pedido = (id: number, parcial: Record<string, unknown> = {}) => ({
  id, status: 'pendente', solicitante: { nome: 'Ana Souza', perfil: 'Colaborador' },
  alteracoes: { nome: 'Ana Souza Lima', banco: 'Banco Novo' }, anteriores: { nome: 'Ana Souza', banco: null },
  resposta: null, decidido_por: null, decidido_em: null, criado_em: '2026-10-02T15:00:00.000Z', ...parcial,
});

const registro = (id: number, parcial: Record<string, unknown> = {}) => ({
  id, acao: 'funcionario.salario_alterado', entidade: 'funcionario', entidade_id: 7, funcionario_id: 7, usuario_id: 1, usuario_nome: 'Rita RH',
  perfil: 'RH', ip: '10.0.0.5', antes: { salario_base: 3000 }, depois: { salario_base: 3500 }, criado_em: '2026-10-02T15:00:00.000Z', ...parcial,
});

const periodos = [
  { id: 2, salario_base: '3500.00', cargo_id: 1, cargo: 'Analista Sênior', departamento_id: 1, departamento: 'Tecnologia', vigencia_inicio: '2026-10-02', vigencia_fim: null },
  { id: 1, salario_base: '3000.00', cargo_id: 1, cargo: 'Analista', departamento_id: 1, departamento: 'Tecnologia', vigencia_inicio: '2025-02-03', vigencia_fim: '2026-10-01' },
];

before(async () => {
  document.cookie = 'hrflow_csrf=token-ficticio; Path=/';
  server = await iniciarVite();
  ({ default: Approvals } = await server.ssrLoadModule('/src/pages/Admin/Approvals.tsx'));
  ({ default: Audit } = await server.ssrLoadModule('/src/pages/Admin/Audit.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://localhost');
    const caminho = `${url.pathname.replace(/^\/api/, '')}${url.search}`;
    const metodo = (init?.method ?? 'GET').toUpperCase();
    chamadas.push({ metodo, caminho, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (metodo === 'PATCH') return decisao();
    if (url.pathname === '/api/solicitacoes-alteracao') return json(pedidos, 200, { 'X-Total-Count': String(pedidos.length) });
    if (url.pathname === '/api/auditoria') return json([registro(2), registro(1, { acao: 'login.falha', entidade: 'usuario', antes: null, depois: { motivo: 'senha_incorreta' }, usuario_nome: null, perfil: null })], 200, { 'X-Total-Count': '2' });
    if (url.pathname === '/api/funcionarios/7/historico-contratual') return json(periodos);
    return json({ erro: 'rota inesperada no teste' }, 404);
  }) as typeof fetch;
});
after(async () => { globalThis.fetch = originalFetch; await server.close(); dom.window.close(); });
beforeEach(() => {
  chamadas = [];
  pedidos = [pedido(5), pedido(6, { solicitante: { nome: 'Caio Lima', perfil: 'Colaborador' }, alteracoes: { email: 'caio.novo@exemplo.invalid' }, anteriores: { email: 'caio@exemplo.invalid' } })];
  decisao = () => json(pedido(5, { status: 'aprovada' }));
});
afterEach(desmontarTudo);

const abrir = async (Tela: ComponentType, rota = '/') => {
  const host = await montar(createElement(QueryClientProvider, { client: novoQueryClient() },
    createElement(MemoryRouter, { initialEntries: [rota] }, createElement(UiProviders, null, createElement(Tela)))));
  for (let i = 0; i < 3; i += 1) await esperar(20);
  return host;
};

const digitar = async (campo: HTMLTextAreaElement, valor: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!.call(campo, valor);
    campo.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};

test('Aprovações: cada pedido mostra quem pede e o valor de antes e o de depois, campo a campo', async () => {
  const host = await abrir(Approvals);
  assert.equal(document.title, 'Aprovações | HRFlow');
  assert.ok(chamadas.some((c) => c.caminho.startsWith('/solicitacoes-alteracao?') && c.caminho.includes('status=pendente')));
  const cartoes = host.querySelectorAll('article');
  assert.equal(cartoes.length, 2);
  assert.match(cartoes[0].textContent ?? '', /Ana Souza/);
  assert.match(cartoes[0].textContent ?? '', /Aguardando decisão/);
  const termos = [...cartoes[0].querySelectorAll('dt')].map((dt) => dt.textContent);
  assert.deepEqual(termos, ['Nome', 'Banco']);
  assert.match(cartoes[0].querySelectorAll('dd')[0].textContent ?? '', /Ana Souza.*Ana Souza Lima/);
  assert.match(cartoes[0].querySelectorAll('dd')[1].textContent ?? '', /vazio.*Banco Novo/);
  assert.match(cartoes[1].textContent ?? '', /caio\.novo@exemplo\.invalid/);
});

test('Aprovações: aprovar confirma, envia a decisão e avisa por toast', async () => {
  const host = await abrir(Approvals);
  await clicar(botaoPorTexto(host, /Aprovar o pedido de Ana Souza/));
  await esperar(20);
  const confirmacao = porRole(document, 'alertdialog') ?? porRole(document, 'dialog');
  assert.ok(confirmacao, 'pede confirmação antes de gravar');
  assert.match(confirmacao.textContent ?? '', /Aprovar o pedido de Ana Souza\?/);
  await clicar(botaoPorTexto(confirmacao, /^Aprovar$/));
  await esperar(40);

  const patch = chamadas.find((c) => c.metodo === 'PATCH')!;
  assert.equal(patch.caminho, '/solicitacoes-alteracao/5');
  assert.deepEqual(patch.corpo, { status: 'aprovada' });
  assert.match(document.querySelector('[role="status"]')?.textContent ?? '', /Pedido de Ana Souza aprovado/);
});

test('Aprovações: recusar abre o motivo, nomeia o campo e envia a resposta', async () => {
  const host = await abrirAprovacoes();
  await clicar(botaoPorTexto(host, /Recusar o pedido de Ana Souza/));
  await esperar(20);
  const dialogo = porRole(document, 'dialog')!;
  assert.match(dialogo.textContent ?? '', /Recusar o pedido de Ana Souza/);
  const motivo = dialogo.querySelector<HTMLTextAreaElement>('textarea')!;
  assert.ok(motivo.id && motivo.name === 'motivo' && dialogo.querySelector(`label[for="${motivo.id}"]`), 'campo com id, name e label');
  await digitar(motivo, '  Use o nome do documento.  ');
  await act(async () => { dialogo.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await esperar(40);

  const patch = chamadas.find((c) => c.metodo === 'PATCH')!;
  assert.deepEqual(patch.corpo, { status: 'recusada', resposta: 'Use o nome do documento.' });
  assert.equal(porRole(document, 'dialog'), null, 'o modal fecha ao concluir');
});

test('Aprovações: a falha da decisão aparece no modal e nada fecha', async () => {
  decisao = () => json({ erro: 'Esta solicitação já está aprovada.' }, 409);
  const host = await abrirAprovacoes();
  await clicar(botaoPorTexto(host, /Recusar o pedido de Ana Souza/));
  await esperar(20);
  const dialogo = porRole(document, 'dialog')!;
  await act(async () => { dialogo.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await esperar(40);
  assert.match(dialogo.querySelector('[role="alert"]')?.textContent ?? '', /já está aprovada/);
  assert.ok(porRole(document, 'dialog'));
});

test('Aprovações: sem pedidos a tela explica e o histórico traz as decisões já tomadas, sem botões de decisão', async () => {
  pedidos = [];
  const vazio = await abrirAprovacoes();
  assert.match(vazio.textContent ?? '', /Nenhum pedido esperando decisão/);
  await desmontarTudo();

  pedidos = [pedido(9, { status: 'recusada', resposta: 'Use o nome do documento.', decidido_por: 'Rita RH', decidido_em: '2026-10-03T12:00:00.000Z' })];
  const host = await abrirAprovacoes();
  await clicar([...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((aba) => aba.textContent === 'Histórico')!);
  await esperar(40);
  assert.ok(chamadas.some((c) => c.caminho.startsWith('/solicitacoes-alteracao?') && !c.caminho.includes('status=')), 'o histórico não filtra por situação');
  assert.match(host.textContent ?? '', /Recusada por Rita RH/);
  assert.match(host.textContent ?? '', /Use o nome do documento/);
  assert.equal([...host.querySelectorAll('button')].filter((b) => /Aprovar|Recusar/.test(b.textContent ?? '')).length, 0);
});

const abrirAprovacoes = () => abrir(Approvals);

test('Auditoria: a trilha da empresa mostra quando, quem, o que mudou e de onde, com nomes legíveis', async () => {
  const host = await abrir(Audit);
  assert.equal(document.title, 'Auditoria | HRFlow');
  assert.ok(chamadas.some((c) => c.caminho.startsWith('/auditoria?') && !c.caminho.includes('entidade=')));
  assert.equal(host.querySelector('caption')?.textContent, 'Registros de auditoria, do mais recente ao mais antigo');
  const texto = host.textContent ?? '';
  assert.match(texto, /Salário alterado/);
  assert.match(texto, /Salário: R\$\s*3\.000,00 → R\$\s*3\.500,00/);
  assert.match(texto, /Rita RH/);
  assert.match(texto, /10\.0\.0\.5/);
  assert.match(texto, /Tentativa de entrada recusada/);
  assert.match(texto, /Motivo: senha incorreta/);
  assert.match(texto, /Sem conta identificada/);
  assert.ok(!host.querySelector('input[type="text"]'), 'só leitura: nenhum campo de edição');
});

test('Auditoria: o filtro por tipo de registro pede ao servidor só aquele tipo', async () => {
  const host = await abrir(Audit);
  const filtro = host.querySelector<HTMLSelectElement>('select[name="entidade"]')!;
  assert.ok(filtro.id && host.querySelector(`label[for="${filtro.id}"]`), 'o filtro tem rótulo');
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!.call(filtro, 'folha');
    filtro.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await esperar(40);
  assert.ok(chamadas.some((c) => c.caminho.startsWith('/auditoria?') && c.caminho.includes('entidade=folha')));
});

test('Auditoria: o histórico de um colaborador pede a trilha dele, mostra o histórico contratual e volta à empresa toda', async () => {
  const host = await abrir(Audit, '/admin/auditoria?colaborador=7&nome=Ana%20Souza');
  assert.equal(document.title, 'Histórico do colaborador | HRFlow');
  assert.equal(host.querySelector('h1')?.textContent, 'Histórico de Ana Souza');
  assert.ok(chamadas.some((c) => c.caminho.startsWith('/auditoria?') && c.caminho.includes('entidade=funcionario') && c.caminho.includes('id=7')));
  assert.ok(chamadas.some((c) => c.caminho === '/funcionarios/7/historico-contratual'));

  const texto = host.textContent ?? '';
  assert.match(texto, /Histórico contratual/);
  assert.match(texto, /02\/10\/2026 a em vigor/);
  assert.match(texto, /03\/02\/2025 a 01\/10\/2026/);
  assert.match(texto, /Analista Sênior/);
  assert.ok(!host.querySelector('select[name="entidade"]'), 'no histórico de uma pessoa o filtro por tipo não faz sentido');
  assert.equal(host.querySelector('a')?.getAttribute('href'), '/admin/auditoria');
  assert.match(host.querySelector('a')?.textContent ?? '', /Ver a empresa toda/);
});
