// O modal de colaborador como o RH o usa: preencher, trocar de aba, salvar e corrigir o que a API recusou.
// Roda o componente de verdade (jsdom + Testing Library), sem a página em volta.
import { dom, abrirVite, limparTela, simularApi } from './support/componentes.ts';
import { test, before, after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, type ComponentType } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ViteDevServer } from 'vite';

const CARGOS = [
  { id: 1, nome: 'Desenvolvedor(a)', departamento_id: 1, departamento_nome: 'TI', nivel: 'Pleno', salario_base: '8000.00', ocupantes: 0 },
  { id: 2, nome: 'Analista de RH', departamento_id: 2, departamento_nome: 'RH', nivel: 'Júnior', salario_base: '4000.00', ocupantes: 0 },
];
const DEPARTAMENTOS = [{ id: 1, nome: 'TI', sigla: 'TI' }, { id: 2, nome: 'RH', sigla: 'RH' }];

type Props = { isOpen: boolean; onClose: () => void; onSave: (dados: Record<string, string>) => Promise<void>; employeeToEdit?: Record<string, string> | null };

let server: ViteDevServer;
let EmployeeModal: ComponentType<Props>;
let restaurarApi: () => void;
let fechamentos: number;
let confirmacoes: string[];
let respostaDaConfirmacao: boolean;

before(async () => {
  server = await abrirVite();
  ({ default: EmployeeModal } = await server.ssrLoadModule('/src/components/Admin/EmployeeModal.tsx'));
  dom.window.confirm = (mensagem?: string) => { confirmacoes.push(String(mensagem)); return respostaDaConfirmacao; };
});

after(async () => {
  await server.close();
  dom.window.close();
});

beforeEach(() => {
  fechamentos = 0;
  confirmacoes = [];
  respostaDaConfirmacao = true;
  ({ restaurar: restaurarApi } = simularApi(({ caminho }) => {
    if (caminho.startsWith('/estrutura/cargos')) return { corpo: CARGOS };
    if (caminho.startsWith('/estrutura/departamentos')) return { corpo: DEPARTAMENTOS };
    return { status: 404, corpo: { erro: 'rota inesperada no teste' } };
  }));
});

afterEach(() => {
  limparTela();
  restaurarApi();
});

const abrir = async (props: Partial<Props> = {}) => {
  const onSave = props.onSave ?? (async () => {});
  render(createElement(EmployeeModal, { isOpen: true, onClose: () => { fechamentos += 1; }, onSave, ...props }));
  // Os cargos e departamentos chegam de forma assíncrona: a aba Contrato os usa.
  await waitFor(() => assert.ok(globalThis.fetch));
};

const campo = <T extends HTMLElement = HTMLInputElement>(nome: string) => {
  const elemento = document.querySelector<T>(`[name="${nome}"]`);
  assert.ok(elemento, `campo ${nome} não está na tela`);
  return elemento;
};

const aba = (nome: RegExp) => screen.getByRole('button', { name: nome });

const preencherPessoal = async (usuario: ReturnType<typeof userEvent.setup>) => {
  await usuario.type(campo('nomeCompleto'), 'Ana Ficticia');
  await usuario.type(campo('emailPessoal'), 'ana@exemplo.invalid');
  await usuario.type(campo('senhaAcesso'), 'senha-ficticia');
};

test('fechado, não renderiza nada', async () => {
  await abrir({ isOpen: false });
  assert.equal(document.body.textContent, '');
});

test('cadastro novo: mostra as três abas e pede a senha de acesso', async () => {
  await abrir();
  assert.ok(screen.getByRole('heading', { name: 'Novo Colaborador' }));
  for (const nome of [/Pessoal/i, /Contrato/i, /Financeiro/i]) assert.ok(aba(nome));
  assert.equal(campo('senhaAcesso').getAttribute('type'), 'password');
});

test('não salva com os campos obrigatórios vazios', async () => {
  const salvos: unknown[] = [];
  await abrir({ onSave: async (dados) => { salvos.push(dados); } });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Confirmar Cadastro' }));
  assert.equal(salvos.length, 0);
});

test('salva o que foi digitado nas três abas, de uma vez', async () => {
  const salvos: Record<string, string>[] = [];
  const usuario = userEvent.setup();
  await abrir({ onSave: async (dados) => { salvos.push(dados); } });

  await preencherPessoal(usuario);
  await usuario.click(aba(/Contrato/i));
  await usuario.type(campo('salarioBase'), '3500');
  await usuario.click(aba(/Financeiro/i));
  await usuario.type(campo('banco'), 'Banco Ficticio');
  await usuario.click(screen.getByRole('button', { name: 'Confirmar Cadastro' }));

  await waitFor(() => assert.equal(salvos.length, 1));
  assert.equal(salvos[0].nomeCompleto, 'Ana Ficticia');
  assert.equal(salvos[0].emailPessoal, 'ana@exemplo.invalid');
  assert.equal(salvos[0].senhaAcesso, 'senha-ficticia');
  assert.equal(salvos[0].salarioBase, '3500');
  assert.equal(salvos[0].banco, 'Banco Ficticio');
});

test('dois cliques seguidos salvam uma vez só e o botão mostra "Salvando..." enquanto espera', async () => {
  let liberar: () => void = () => {};
  const pendente = new Promise<void>((resolve) => { liberar = resolve; });
  let chamadas = 0;
  const usuario = userEvent.setup();
  await abrir({ onSave: async () => { chamadas += 1; await pendente; } });
  await preencherPessoal(usuario);

  // Dois envios no mesmo instante, antes de o React redesenhar o botão desabilitado: só a guarda do componente os separa.
  const formulario = document.querySelector('form') as HTMLFormElement;
  fireEvent.submit(formulario);
  fireEvent.submit(formulario);

  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Salvando...' })));
  assert.equal((screen.getByRole('button', { name: 'Salvando...' }) as HTMLButtonElement).disabled, true);
  assert.equal(chamadas, 1);
  liberar();
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Confirmar Cadastro' })));
});

test('escolher o cargo sugere departamento, nível e salário, mas nunca troca o que o RH digitou', async () => {
  const usuario = userEvent.setup();
  await abrir();
  await usuario.click(aba(/Contrato/i));
  await waitFor(() => assert.ok(campo<HTMLSelectElement>('cargoId').querySelector('option[value="1"]')));

  await usuario.selectOptions(campo('cargoId'), '1');
  assert.equal(campo('salarioBase').getAttribute('value') ?? (campo('salarioBase') as HTMLInputElement).value, '8000');
  assert.equal((campo('departamentoId') as unknown as HTMLSelectElement).value, '1');
  assert.equal((campo('nivel') as unknown as HTMLSelectElement).value, 'Pleno');

  await usuario.clear(campo('salarioBase'));
  await usuario.type(campo('salarioBase'), '9000');
  await usuario.selectOptions(campo('cargoId'), '2');
  assert.equal((campo('salarioBase') as HTMLInputElement).value, '9000');
});

test('a API recusa o e-mail: o erro aparece no modal, a aba do campo reabre e o foco vai a ele', async () => {
  const mensagem = 'Este e-mail já está registado no sistema.';
  const usuario = userEvent.setup();
  await abrir({
    onSave: async () => {
      const { HttpError } = await server.ssrLoadModule('/src/services/httpClient.ts');
      throw new HttpError(mensagem, 400, { erro: mensagem, detalhes: [{ campo: 'email', mensagem }] });
    },
  });
  await preencherPessoal(usuario);
  await usuario.click(aba(/Contrato/i));
  await usuario.click(screen.getByRole('button', { name: 'Confirmar Cadastro' }));

  const alerta = await screen.findByRole('alert');
  assert.match(alerta.textContent ?? '', /já está registado/);
  assert.equal(document.activeElement, campo('emailPessoal'));
  assert.equal((campo('emailPessoal') as HTMLInputElement).value, 'ana@exemplo.invalid');
});

test('editar abre com os dados do colaborador e sem o campo de senha', async () => {
  await abrir({ employeeToEdit: { id: '7', nomeCompleto: 'Bia Ficticia', emailPessoal: 'bia@exemplo.invalid', status: 'Ativo' } });
  assert.ok(screen.getByRole('heading', { name: 'Editar Perfil' }));
  assert.equal((campo('nomeCompleto') as HTMLInputElement).value, 'Bia Ficticia');
  assert.equal(document.querySelector('[name="senhaAcesso"]'), null);
  assert.ok(screen.getByRole('button', { name: 'Guardar Alterações' }));
});

test('Cancelar fecha; clicar no fundo com dados digitados pede confirmação antes de descartar', async () => {
  const usuario = userEvent.setup();
  await abrir();
  await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
  assert.equal(fechamentos, 1);

  await usuario.click(screen.getByTestId('employee-modal-backdrop'));
  assert.equal(fechamentos, 2, 'sem dados digitados, o fundo fecha sem perguntar');
  assert.deepEqual(confirmacoes, []);

  await usuario.type(campo('nomeCompleto'), 'Ana');
  respostaDaConfirmacao = false;
  await usuario.click(screen.getByTestId('employee-modal-backdrop'));
  assert.equal(confirmacoes.length, 1);
  assert.equal(fechamentos, 2, 'recusar a confirmação mantém o modal aberto');

  respostaDaConfirmacao = true;
  await usuario.click(screen.getByTestId('employee-modal-backdrop'));
  assert.equal(fechamentos, 3);
});

test('falha ao carregar cargos e departamentos aparece como alerta, não como lista vazia', async () => {
  restaurarApi();
  ({ restaurar: restaurarApi } = simularApi(() => ({ status: 500, corpo: { erro: 'Erro ao buscar cargos' } })));
  await abrir();
  const alerta = await screen.findByRole('alert');
  assert.match(alerta.textContent ?? '', /Erro ao buscar cargos/);
});
