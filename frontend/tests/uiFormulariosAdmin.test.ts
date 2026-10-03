// Formulários e modais da gestão: contrato de acessibilidade (rótulo, id e name em todo campo, foco, Esc,
// retorno do foco) sobre os componentes reais de colaboradores e estrutura.
import { after, afterEach, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, botaoPorTexto, clicar, dom, createElement, desmontarTudo, esperar, iniciarVite, montar, porRole, teclar } from './support/ui.ts';
import { instalarApi, type Chamada } from './support/apiAdmin.ts';
import type { ComponentType } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ViteDevServer } from 'vite';
import { novoQueryClient } from './support/consulta.ts';

let server: ViteDevServer;
let Employees: ComponentType;
let OrgStructure: ComponentType;
let UiProviders: ComponentType<{ children: unknown }>;
let AuthProvider: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;
let chamadas: Chamada[] = [];

before(async () => {
  server = await iniciarVite();
  ({ default: Employees } = await server.ssrLoadModule('/src/pages/Admin/Employees.tsx'));
  ({ default: OrgStructure } = await server.ssrLoadModule('/src/pages/Admin/OrgStructure.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
});
after(async () => { globalThis.fetch = originalFetch; await server.close(); });
beforeEach(() => { chamadas = []; instalarApi(chamadas); });
afterEach(desmontarTudo);

const abrirTela = async (Tela: ComponentType) => {
  // A tela de colaboradores decide os botões pelo perfil da sessão (cookie de CSRF = há sessão a confirmar).
  document.cookie = 'hrflow_csrf=token-ficticio; Path=/';
  const cliente = novoQueryClient();
  await montar(createElement(QueryClientProvider, { client: cliente },
    createElement(MemoryRouter, null, createElement(AuthProvider, null, createElement(UiProviders, null, createElement(Tela))))));
  await esperar(20);
};

const dialogo = () => porRole(document, 'dialog')!;
const dialogos = () => document.querySelectorAll('[role="dialog"]');

// Todo campo do diálogo aberto tem id, name e um <label for> que aponta para ele.
const verificarCampos = (raiz: ParentNode, esperados: string[]) => {
  const controles = [...raiz.querySelectorAll<HTMLInputElement>('input, select, textarea')];
  assert.deepEqual(controles.map((c) => c.name), esperados);
  for (const controle of controles) {
    assert.ok(controle.id, `o campo ${controle.name} tem id`);
    assert.ok(controle.name, 'todo campo tem name');
    const rotulo = document.querySelector(`label[for="${controle.id}"]`);
    assert.ok(rotulo?.textContent?.trim(), `o campo ${controle.name} tem <label for> com texto`);
  }
  const ids = controles.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'os ids não se repetem');
};

const abrirAba = async (nome: RegExp) => { await clicar(botaoPorTexto(dialogo(), nome)); await esperar(); };

test('colaborador: as três abas têm todo campo com label, id e name, e seguem o padrão de abas', async () => {
  await abrirTela(Employees);
  await clicar(botaoPorTexto(document, /Adicionar Colaborador/));
  await esperar();

  const abas = [...dialogo().querySelectorAll<HTMLElement>('[role="tab"]')];
  assert.deepEqual(abas.map((a) => a.textContent), ['Pessoal', 'Contrato', 'Financeiro']);
  assert.equal(porRole(dialogo(), 'tablist')?.getAttribute('aria-label'), 'Seções do cadastro');

  verificarCampos(dialogo(), ['nomeCompleto', 'emailPessoal', 'telefone', 'cpf', 'dataNascimento', 'senhaAcesso', 'enderecoCompleto']);
  assert.equal(abas[0].getAttribute('aria-selected'), 'true');
  assert.equal(porRole(dialogo(), 'tabpanel')?.getAttribute('aria-labelledby'), abas[0].id);

  await abrirAba(/Contrato/);
  verificarCampos(dialogo(), ['dataAdmissao', 'cargoId', 'nivel', 'departamentoId', 'tipoContrato', 'salarioBase']);
  assert.equal(dialogo().querySelector('[role="tab"][aria-selected="true"]')?.textContent, 'Contrato');
  assert.equal(porRole(dialogo(), 'tabpanel')?.getAttribute('aria-labelledby'), abas[1].id);

  await abrirAba(/Financeiro/);
  verificarCampos(dialogo(), ['banco', 'agencia', 'conta', 'tipoConta']);
});

test('colaborador: campos obrigatórios e autopreenchimento corretos', async () => {
  await abrirTela(Employees);
  await clicar(botaoPorTexto(document, /Adicionar Colaborador/));
  await esperar();
  const campo = (nome: string) => dialogo().querySelector<HTMLInputElement>(`[name="${nome}"]`)!;
  assert.equal(campo('nomeCompleto').required, true);
  assert.equal(campo('emailPessoal').required, true);
  assert.equal(campo('senhaAcesso').required, true);
  assert.equal(campo('telefone').required, false);
  assert.equal(campo('emailPessoal').autocomplete, 'email');
  assert.equal(campo('senhaAcesso').autocomplete, 'new-password');
});

test('colaborador: o foco entra no primeiro campo e volta ao botão de origem ao fechar sem dados', async () => {
  await abrirTela(Employees);
  const origem = botaoPorTexto(document, /Adicionar Colaborador/);
  origem.focus();
  await clicar(origem);
  await esperar();
  assert.equal(document.activeElement, dialogo().querySelector('[name="nomeCompleto"]'));

  await teclar(document.activeElement!, 'Escape');
  await esperar();
  assert.equal(dialogos().length, 0, 'sem dados digitados o Esc fecha direto');
  assert.equal(document.activeElement, origem, 'o foco volta ao botão que abriu o modal');
});

test('colaborador: Esc com dados digitados pergunta antes de descartar; recusar mantém, confirmar fecha e devolve o foco', async () => {
  await abrirTela(Employees);
  const origem = botaoPorTexto(document, /Adicionar Colaborador/);
  origem.focus();
  await clicar(origem);
  await esperar();

  const nome = dialogo().querySelector<HTMLInputElement>('[name="nomeCompleto"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(nome, 'Ana Ficticia');
    nome.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });

  await teclar(document, 'Escape');
  await esperar();
  assert.equal(dialogos().length, 2, 'a pergunta abre sobre o formulário');
  const pergunta = dialogos()[1] as HTMLElement;
  assert.match(pergunta.textContent ?? '', /Descartar alterações\?/);
  assert.equal(document.activeElement?.textContent, 'Continuar editando', 'a ação segura recebe o foco');

  await teclar(document, 'Escape');
  await esperar();
  assert.equal(dialogos().length, 1, 'Esc na pergunta só fecha a pergunta');
  assert.equal(document.querySelector<HTMLInputElement>('[name="nomeCompleto"]')!.value, 'Ana Ficticia');

  await teclar(document, 'Escape');
  await esperar();
  await clicar(botaoPorTexto(dialogos()[1] as HTMLElement, /^Descartar$/));
  await esperar();
  assert.equal(dialogos().length, 0);
  assert.equal(document.activeElement, origem);
});

test('estrutura: os formulários de departamento e de cargo têm label, id e name em todo campo', async () => {
  await abrirTela(OrgStructure);
  await clicar(botaoPorTexto(document, /Criar Departamento/));
  await esperar();
  verificarCampos(dialogo(), ['name', 'sigla', 'manager', 'description']);
  assert.equal(document.activeElement, dialogo().querySelector('[name="name"]'), 'o foco entra no primeiro campo');
  await teclar(document, 'Escape');
  await esperar();
  assert.equal(dialogos().length, 0);

  await clicar(botaoPorTexto(document, /Cargos e Funções/));
  await esperar();
  await clicar(botaoPorTexto(document, /Criar Cargo/));
  await esperar();
  verificarCampos(dialogo(), ['title', 'department', 'level', 'salary']);
  assert.equal(document.activeElement, dialogo().querySelector('[name="title"]'));
  assert.equal(dialogo().querySelector<HTMLInputElement>('[name="title"]')!.required, true);
});

test('estrutura: o foco volta ao botão que abriu o modal e as abas da página são abas de verdade', async () => {
  await abrirTela(OrgStructure);
  const tablist = porRole(document, 'tablist')!;
  assert.deepEqual([...tablist.querySelectorAll('[role="tab"]')].map((a) => a.textContent), ['Departamentos', 'Cargos e Funções']);
  assert.ok(porRole(document, 'tabpanel'));

  const origem = botaoPorTexto(document, /Criar Departamento/);
  origem.focus();
  await clicar(origem);
  await esperar();
  await clicar(botaoPorTexto(dialogo(), /^Fechar$/));
  await esperar();
  assert.equal(dialogos().length, 0);
  assert.equal(document.activeElement, origem);
});

test('o modal de colaborador é role=dialog com aria-modal e nome', async () => {
  await abrirTela(Employees);
  await clicar(botaoPorTexto(document, /Adicionar Colaborador/));
  await esperar();
  assert.equal(dialogo().getAttribute('aria-modal'), 'true');
  assert.equal(document.getElementById(dialogo().getAttribute('aria-labelledby')!)?.textContent, 'Novo Colaborador');
});
