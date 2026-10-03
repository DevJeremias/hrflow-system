// Tabelas e exclusões da gestão: tabelas semânticas que viram cartões no celular, e o fluxo de exclusão
// com diálogo de confirmação e toast no lugar de confirm() e alert().
import { after, afterEach, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { act, botaoPorTexto, clicar, dom, createElement, desmontarTudo, esperar, iniciarVite, montar, porRole } from './support/ui.ts';
import { instalarApi, json, type Chamada } from './support/apiAdmin.ts';
import type { ComponentType } from 'react';
import type { ViteDevServer } from 'vite';
import { novoQueryClient } from './support/consulta.ts';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });

let server: ViteDevServer;
let Employees: ComponentType;
let OrgStructure: ComponentType;
let Payroll: ComponentType;
let UiProviders: ComponentType<{ children: unknown }>;
let AuthProvider: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;
let chamadas: Chamada[] = [];

before(async () => {
  server = await iniciarVite();
  ({ default: Employees } = await server.ssrLoadModule('/src/pages/Admin/Employees.tsx'));
  ({ default: OrgStructure } = await server.ssrLoadModule('/src/pages/Admin/OrgStructure.tsx'));
  ({ default: Payroll } = await server.ssrLoadModule('/src/pages/Admin/Payroll.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
});
after(async () => { globalThis.fetch = originalFetch; await server.close(); });
beforeEach(() => { chamadas = []; instalarApi(chamadas); });
afterEach(desmontarTudo);

const abrirTela = async (Tela: ComponentType) => {
  document.cookie = 'hrflow_csrf=token-ficticio; Path=/';
  const cliente = novoQueryClient();
  const host = await montar(createElement(QueryClientProvider, { client: cliente },
    createElement(MemoryRouter, null, createElement(AuthProvider, null, createElement(UiProviders, null, createElement(Tela))))));
  await esperar(20);
  return host;
};

const cabecalhos = (host: HTMLElement) => [...host.querySelectorAll('thead th')].map((th) => [th.textContent, th.getAttribute('scope')]);

test('colaboradores: tabela semântica com legenda, th scope=col e ações rotuladas', async () => {
  const host = await abrirTela(Employees);
  assert.equal(host.querySelector('caption')?.textContent, 'Colaboradores da empresa');
  assert.deepEqual(cabecalhos(host), [['Colaborador', 'col'], ['Cargo', 'col'], ['Setor', 'col'], ['Status', 'col'], ['Ações', 'col']]);
  assert.ok(host.querySelector('button[aria-label="Editar colaborador Bia Ficticia"]'));
  assert.ok(host.querySelector('button[aria-label="Excluir cadastro de Bia Ficticia"]'));
  assert.equal(host.querySelector('tbody tr td:nth-child(4)')?.textContent, 'Ativo');
});

test('cargos: a coluna Ações existe no modo cartão, com editar e excluir nomeados', async () => {
  const host = await abrirTela(OrgStructure);
  await clicar(botaoPorTexto(host, /Cargos e Funções/));
  assert.equal(host.querySelector('caption')?.textContent, 'Cargos da empresa');
  assert.deepEqual(cabecalhos(host).map(([nome]) => nome), ['Cargo', 'Departamento', 'Nível', 'Salário base', 'Ocupantes', 'Ações']);
  assert.ok(cabecalhos(host).every(([, escopo]) => escopo === 'col'));

  const linha = host.querySelector('tbody tr')!;
  const celulas = [...linha.querySelectorAll('td')];
  assert.deepEqual(celulas.map((td) => td.getAttribute('data-label')), ['Cargo', 'Departamento', 'Nível', 'Salário base', 'Ocupantes', null]);
  const acoes = celulas[5];
  assert.ok(acoes.querySelector('button[aria-label="Editar cargo Desenvolvedor(a)"]'));
  assert.ok(acoes.querySelector('button[aria-label="Excluir cargo Desenvolvedor(a)"]'));
  // Abaixo de md a linha é um cartão `block`: nada fica fora da tela nem escondido.
  assert.match(linha.className, /\bblock\b/);
  assert.match(host.querySelector('table')!.className, /\bblock\b/);
});

test('a tabela de cargos não esconde colunas com overflow-hidden nem largura mínima fixa', () => {
  const fonte = readFileSync(new URL('../src/components/Admin/OrgRolesTable.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(fonte, /overflow-hidden/);
  assert.doesNotMatch(fonte, /min-w-\[/);
  const tabela = readFileSync(new URL('../src/components/ui/DataTable.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(tabela, /overflow-hidden/);
});

test('folha: tabela semântica com legenda e um botão de holerite rotulado por colaborador', async () => {
  const host = await abrirTela(Payroll);
  assert.equal(host.querySelector('caption')?.textContent, 'Holerites individuais da competência');
  assert.deepEqual(cabecalhos(host).map(([nome]) => nome), ['Colaborador', 'Salário Base', 'Proventos (+ extras)', 'Descontos', 'Líquido Final', 'Ações']);
  const ver = host.querySelector<HTMLButtonElement>('button[aria-label="Ver holerite de Bia Ficticia"]')!;
  assert.ok(ver, 'abrir o holerite é um botão, não uma linha clicável sem teclado');
  assert.ok(host.querySelector('select[name="setor"]'), 'o filtro de setor tem name');
  assert.ok(host.querySelector('label[for^="setor-"]'), 'e um rótulo');
  ver.focus();
  await clicar(ver);
  assert.equal(porRole(document, 'dialog')?.getAttribute('aria-modal'), 'true', 'o holerite abre como diálogo');
  await act(async () => { document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  await esperar();
  assert.equal(porRole(document, 'dialog'), null);
  assert.equal(document.activeElement, ver, 'o foco volta ao botão do holerite');
});

const responder = async (resposta: 'Excluir' | 'Excluir cadastro' | 'Cancelar') => {
  const dialogo = porRole(document, 'dialog');
  assert.ok(dialogo, 'a exclusão pede confirmação num diálogo');
  assert.match(dialogo.textContent ?? '', /Excluir/);
  await clicar(botaoPorTexto(dialogo, new RegExp(`^${resposta}$`)));
  await esperar(20);
};
const gravacoes = () => chamadas.filter((c) => c.metodo !== 'GET');

// Excluir um cadastro passa pelo diálogo do ciclo de vida do colaborador (B-13): ele explica o efeito e confirma.
test('excluir colaborador: cancelar não chama a API; confirmar chama DELETE e mostra toast de sucesso', async () => {
  const host = await abrirTela(Employees);
  const excluir = host.querySelector<HTMLButtonElement>('button[aria-label="Excluir cadastro de Bia Ficticia"]')!;
  excluir.focus();

  await clicar(excluir);
  assert.match(porRole(document, 'dialog')!.textContent ?? '', /Excluir o cadastro de Bia Ficticia/);
  await responder('Cancelar');
  assert.deepEqual(gravacoes(), []);
  assert.equal(document.activeElement, excluir, 'cancelar devolve o foco ao botão');

  await clicar(excluir);
  await responder('Excluir cadastro');
  assert.deepEqual(gravacoes().map((c) => `${c.metodo} ${c.caminho}`), ['DELETE /funcionarios/7']);
  assert.equal(document.querySelector('[role="status"]')?.textContent, 'Cadastro excluído.');
});

test('excluir colaborador: erro da API aparece dentro do diálogo, que continua aberto, sem alert nativo', async () => {
  instalarApi(chamadas, () => json(400, { erro: 'Colaborador tem registros de ponto.' }));
  const host = await abrirTela(Employees);
  await clicar(host.querySelector('button[aria-label="Excluir cadastro de Bia Ficticia"]')!);
  await responder('Excluir cadastro');
  assert.equal(porRole(document, 'dialog')?.querySelector('[role="alert"]')?.textContent, 'Colaborador tem registros de ponto.');
  assert.ok(host.querySelector('button[aria-label="Excluir cadastro de Bia Ficticia"]'), 'a linha continua na lista');
});

test('excluir cargo: confirmar chama DELETE e mostra o toast; erro da API vira toast de erro', async () => {
  const host = await abrirTela(OrgStructure);
  await clicar(botaoPorTexto(host, /Cargos e Funções/));
  await clicar(host.querySelector('button[aria-label="Excluir cargo Analista de RH"]')!);
  assert.match(porRole(document, 'dialog')!.textContent ?? '', /Excluir o cargo "Analista de RH"\?/);
  await responder('Excluir');
  assert.deepEqual(gravacoes().map((c) => `${c.metodo} ${c.caminho}`), ['DELETE /estrutura/cargos/20']);
  assert.equal(document.querySelector('[role="status"]')?.textContent, 'Cargo "Analista de RH" excluído.');

  instalarApi(chamadas, () => json(400, { erro: 'Cargo tem colaboradores.' }));
  await clicar(host.querySelector('button[aria-label="Excluir cargo Desenvolvedor(a)"]')!);
  await responder('Excluir');
  assert.equal(document.querySelector('[role="alert"]')?.textContent, 'Cargo tem colaboradores.');
});
