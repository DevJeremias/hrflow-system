// B-22: na lista de colaboradores a gestão exporta os dados de uma pessoa, abre o histórico dela e, sendo
// Administrador, anonimiza o cadastro de quem já saiu. Montado com o Vite e uma API falsa.
import { after, afterEach, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act, botaoPorTexto, clicar, createElement, desmontarTudo, dom, esperar, iniciarVite, montar, porRole } from './support/ui.ts';
import { novoQueryClient } from './support/consulta.ts';
import type { ComponentType } from 'react';
import type { ViteDevServer } from 'vite';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });

let server: ViteDevServer;
let Employees: ComponentType;
let AuthProvider: ComponentType<{ children: unknown }>;
let UiProviders: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;

interface Chamada { metodo: string; caminho: string }
let chamadas: Chamada[] = [];
let perfil: 'Administrador' | 'RH' = 'Administrador';
let baixados: { nome: string; conteudo: string }[] = [];

const json = (corpo: unknown, status = 200, cabecalhos: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', ...cabecalhos } });

const funcionario = (id: number, nome: string, parcial: Record<string, unknown> = {}) => ({
  id, nome, email: `${nome.split(' ')[0].toLowerCase()}@exemplo.invalid`, cargo_id: 10, cargo_nome: 'Analista', departamento_id: 1, departamento_nome: 'TI', status: 'Ativo',
  usuario_perfil: 'Colaborador', tem_movimento: true, anonimizado: false, ...parcial,
});

const LISTA = [
  funcionario(7, 'Bia Ficticia'),
  funcionario(8, 'Caio Desligado', { status: 'Inativo', data_desligamento: '2026-09-30', motivo_desligamento: 'Pedido de demissão' }),
  funcionario(9, 'Dora Anonimizada', { nome: 'Colaborador anonimizado 9', status: 'Inativo', data_desligamento: '2026-01-10', motivo_desligamento: 'Fim', anonimizado: true }),
];

before(async () => {
  document.cookie = 'hrflow_csrf=token-ficticio; Path=/';
  server = await iniciarVite();
  ({ default: Employees } = await server.ssrLoadModule('/src/pages/Admin/Employees.tsx'));
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  dom.window.URL.createObjectURL = (blob: Blob) => { void blob; return 'blob:teste'; };
  dom.window.URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function baixar(this: HTMLAnchorElement) { baixados.push({ nome: this.download, conteudo: '' }); };
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = new URL(String(entrada), 'http://localhost').pathname.replace(/^\/api/, '');
    const metodo = (init?.method ?? 'GET').toUpperCase();
    chamadas.push({ metodo, caminho });
    if (caminho === '/auth/sessao') return json({ id: 1, nome: 'Gestor Ficticio', perfil, empresa_nome: 'Empresa Ficticia Alfa Ltda', funcionario_id: perfil === 'RH' ? 99 : null, avatar: null });
    if (caminho === '/funcionarios' && metodo === 'GET') return json(LISTA, 200, { 'X-Total-Count': String(LISTA.length) });
    if (caminho === '/funcionarios/7/exportar') return json({ titular: { nome: 'Bia Ficticia' }, exportado_em: '2026-10-03T12:00:00.000Z' });
    if (caminho === '/funcionarios/8/anonimizar') return json({ mensagem: 'Cadastro anonimizado.' });
    if (caminho.startsWith('/estrutura/')) return json([]);
    return json({ erro: 'rota inesperada no teste' }, 404);
  }) as typeof fetch;
});
after(async () => { globalThis.fetch = originalFetch; await server.close(); dom.window.close(); });
beforeEach(() => { chamadas = []; baixados = []; perfil = 'Administrador'; });
afterEach(desmontarTudo);

const Local: ComponentType = () => createElement('output', { 'data-rota': useLocation().pathname + useLocation().search });

const abrir = async () => {
  const host = await montar(createElement(QueryClientProvider, { client: novoQueryClient() },
    createElement(MemoryRouter, { initialEntries: ['/admin/colaboradores'] }, createElement(AuthProvider, null, createElement(UiProviders, null,
      createElement(Routes, null,
        createElement(Route, { path: '/admin/colaboradores', element: createElement(Employees) }),
        createElement(Route, { path: '*', element: createElement(Local) })))))));
  for (let i = 0; i < 4; i += 1) await esperar(20);
  return host;
};

test('exportar baixa o JSON do colaborador com o código do cadastro no nome do arquivo', async () => {
  const host = await abrir();
  await clicar(botaoPorTexto(host, /Exportar os dados de Bia Ficticia/));
  await esperar(40);
  assert.ok(chamadas.some((c) => c.metodo === 'GET' && c.caminho === '/funcionarios/7/exportar'));
  assert.deepEqual(baixados.map((b) => b.nome), ['colaborador-7.json']);
  assert.match(document.querySelector('[role="status"]')?.textContent ?? '', /Dados de Bia Ficticia exportados/);
});

test('o histórico leva à auditoria daquele colaborador', async () => {
  const host = await abrir();
  await clicar(botaoPorTexto(host, /Ver o histórico de Bia Ficticia/));
  await esperar(20);
  assert.equal(host.querySelector('output')?.getAttribute('data-rota'), '/admin/auditoria?colaborador=7&nome=Bia%20Ficticia');
});

test('o Administrador anonimiza quem foi desligado, depois de ler o que será apagado', async () => {
  const host = await abrir();
  assert.equal([...host.querySelectorAll('button')].some((b) => /Anonimizar o cadastro de Bia/.test(b.getAttribute('aria-label') ?? '')), false, 'quem ainda trabalha não se anonimiza');
  await clicar(botaoPorTexto(host, /Anonimizar o cadastro de Caio Desligado/));
  await esperar(20);

  const dialogo = porRole(document, 'dialog')!;
  assert.match(dialogo.textContent ?? '', /Anonimizar o cadastro de Caio Desligado/);
  assert.match(dialogo.textContent ?? '', /apagados para sempre\. Não há como desfazer/);
  assert.match(dialogo.textContent ?? '', /As marcações de ponto, as decisões e os valores da folha continuam/);
  assert.equal(chamadas.some((c) => c.metodo === 'POST'), false, 'nada acontece antes de confirmar');

  await act(async () => { dialogo.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await esperar(40);
  assert.ok(chamadas.some((c) => c.metodo === 'POST' && c.caminho === '/funcionarios/8/anonimizar'));
  assert.equal(porRole(document, 'dialog'), null);
});

test('o cadastro já anonimizado mostra a marca e só oferece exportar e ver o histórico', async () => {
  const host = await abrir();
  assert.match(host.textContent ?? '', /Anonimizado/);
  const nomes = [...host.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? '').filter((r) => /Colaborador anonimizado 9/.test(r));
  assert.deepEqual(nomes, ['Ver o histórico de Colaborador anonimizado 9', 'Exportar os dados de Colaborador anonimizado 9']);
});

test('o RH exporta e vê o histórico, mas não anonimiza', async () => {
  perfil = 'RH';
  const host = await abrir();
  const rotulos = [...host.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? '');
  assert.ok(rotulos.includes('Exportar os dados de Caio Desligado'));
  assert.ok(rotulos.includes('Ver o histórico de Caio Desligado'));
  assert.equal(rotulos.some((r) => /Anonimizar/.test(r)), false);
});
