// O modal de departamento e cargo: o formulário que a tela de estrutura abre, sem a página em volta.
import { dom, abrirVite, limparTela } from './support/componentes.ts';
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, type ComponentType } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ViteDevServer } from 'vite';

type Props = {
  type: 'department' | 'role';
  item?: Record<string, unknown>;
  departments: { id: string; name: string }[];
  onClose: () => void;
  onSave: (dados: Record<string, unknown>) => Promise<void>;
};

const DEPARTAMENTOS = [{ id: '1', name: 'Tecnologia' }, { id: '2', name: 'Pessoas' }];

let server: ViteDevServer;
let OrgFormModal: ComponentType<Props>;
let fechamentos: number;

before(async () => {
  server = await abrirVite();
  ({ default: OrgFormModal } = await server.ssrLoadModule('/src/components/Admin/OrgFormModal.tsx'));
});

after(async () => {
  await server.close();
  dom.window.close();
});

afterEach(() => {
  limparTela();
  fechamentos = 0;
});

const abrir = (props: Partial<Props> = {}) => {
  fechamentos = 0;
  render(createElement(OrgFormModal, {
    type: 'department', departments: DEPARTAMENTOS, onClose: () => { fechamentos += 1; }, onSave: async () => {}, ...props,
  }));
};

const campo = <T extends HTMLElement = HTMLInputElement>(nome: string) => {
  const elemento = document.querySelector<T>(`[name="${nome}"]`);
  assert.ok(elemento, `campo ${nome} não está na tela`);
  return elemento;
};

test('departamento novo: salva nome, sigla, gestor e descrição digitados', async () => {
  const salvos: Record<string, unknown>[] = [];
  const usuario = userEvent.setup();
  abrir({ onSave: async (dados) => { salvos.push(dados); } });

  assert.ok(screen.getByRole('heading', { name: 'Novo Departamento' }));
  await usuario.type(campo('name'), 'Engenharia');
  await usuario.type(campo('sigla'), 'ENG');
  await usuario.type(campo('manager'), 'Gestora Ficticia');
  await usuario.type(campo('description'), 'Constrói o produto.');
  await usuario.click(screen.getByRole('button', { name: 'Finalizar Registro' }));

  await waitFor(() => assert.equal(salvos.length, 1));
  assert.deepEqual(salvos[0], { name: 'Engenharia', sigla: 'ENG', manager: 'Gestora Ficticia', description: 'Constrói o produto.', id: undefined });
});

test('cargo novo: oferece os departamentos recebidos e salva a escolha, o nível e o salário', async () => {
  const salvos: Record<string, unknown>[] = [];
  const usuario = userEvent.setup();
  abrir({ type: 'role', onSave: async (dados) => { salvos.push(dados); } });

  assert.ok(screen.getByRole('heading', { name: 'Novo Cargo' }));
  const opcoes = [...campo<HTMLSelectElement>('department').options].map((opcao) => opcao.textContent);
  assert.deepEqual(opcoes, ['Selecione...', 'Tecnologia', 'Pessoas']);

  await usuario.type(campo('title'), 'Analista');
  await usuario.selectOptions(campo('department'), 'Pessoas');
  await usuario.selectOptions(campo('level'), 'Sênior');
  await usuario.type(campo('salary'), '6500');
  await usuario.click(screen.getByRole('button', { name: 'Finalizar Registro' }));

  await waitFor(() => assert.equal(salvos.length, 1));
  assert.deepEqual(salvos[0], { title: 'Analista', department: 'Pessoas', level: 'Sênior', salary: '6500', id: undefined });
});

test('não salva com os campos obrigatórios vazios', async () => {
  const salvos: unknown[] = [];
  abrir({ onSave: async (dados) => { salvos.push(dados); } });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Finalizar Registro' }));
  assert.equal(salvos.length, 0);
});

test('editar abre com os dados atuais e devolve o id junto', async () => {
  const salvos: Record<string, unknown>[] = [];
  abrir({ item: { id: '9', name: 'Financeiro', sigla: 'FIN', manager: 'Gestor Ficticio', description: '' }, onSave: async (dados) => { salvos.push(dados); } });

  assert.ok(screen.getByRole('heading', { name: 'Editar Departamento' }));
  assert.equal(campo('name').getAttribute('value'), 'Financeiro');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Finalizar Registro' }));

  await waitFor(() => assert.equal(salvos.length, 1));
  assert.equal(salvos[0].id, '9');
  assert.equal(salvos[0].name, 'Financeiro');
});

test('a falha ao salvar aparece no modal, com o que foi digitado preservado e o botão liberado', async () => {
  const usuario = userEvent.setup();
  abrir({ onSave: async () => { throw new Error('Já existe um departamento com esta sigla.'); } });
  await usuario.type(campo('name'), 'Engenharia');
  await usuario.type(campo('sigla'), 'ENG');
  await usuario.click(screen.getByRole('button', { name: 'Finalizar Registro' }));

  const alerta = await screen.findByRole('alert');
  assert.match(alerta.textContent ?? '', /Já existe um departamento com esta sigla/);
  assert.equal(campo('name').value, 'Engenharia');
  assert.equal((screen.getByRole('button', { name: 'Finalizar Registro' }) as HTMLButtonElement).disabled, false);
});

test('dois envios no mesmo instante salvam uma vez só', async () => {
  let chamadas = 0;
  let liberar: () => void = () => {};
  const pendente = new Promise<void>((resolve) => { liberar = resolve; });
  const usuario = userEvent.setup();
  abrir({ onSave: async () => { chamadas += 1; await pendente; } });
  await usuario.type(campo('name'), 'Engenharia');
  await usuario.type(campo('sigla'), 'ENG');

  const formulario = document.querySelector('form') as HTMLFormElement;
  fireEvent.submit(formulario);
  fireEvent.submit(formulario);

  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Salvando...' })));
  assert.equal(chamadas, 1);
  assert.equal((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled, true, 'enquanto salva, não dá para cancelar');
  liberar();
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Finalizar Registro' })));
});

test('Cancelar fecha o modal', async () => {
  const usuario = userEvent.setup();
  abrir();
  await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
  assert.equal(fechamentos, 1);
});
