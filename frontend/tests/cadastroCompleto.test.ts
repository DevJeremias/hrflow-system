// Cadastro completo na tela (B-23): documentos com máscara, endereço e contato, dependentes, a
// importação por CSV com o relatório de erros por linha e o cadastro de empresa com CNPJ e confirmação
// de senha. Roda os componentes de verdade (jsdom + Testing Library), com a API simulada.
import { dom, abrirVite, limparTela, simularApi, resposta } from './support/componentes.ts';
import { test, before, after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, type ComponentType } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ViteDevServer } from 'vite';
import { comConsulta } from './support/consulta.ts';

type Dados = Record<string, string>;
type PropsDoModal = { isOpen: boolean; onClose: () => void; onSave: (dados: Dados) => Promise<void>; employeeToEdit?: Dados | null };

let server: ViteDevServer;
let EmployeeModal: ComponentType<PropsDoModal>;
let ImportEmployeesModal: ComponentType<{ onClose: () => void }>;
let Contact: ComponentType;
let UiProviders: ComponentType<{ children: unknown }>;
let restaurarApi: () => void;
let chamadas: ReturnType<typeof simularApi>['chamadas'];
let dependentes: Record<string, unknown>[];

before(async () => {
  server = await abrirVite();
  ({ default: EmployeeModal } = await server.ssrLoadModule('/src/components/Admin/EmployeeModal.tsx'));
  ({ default: ImportEmployeesModal } = await server.ssrLoadModule('/src/components/Admin/ImportEmployeesModal.tsx'));
  ({ default: Contact } = await server.ssrLoadModule('/src/pages/Landing/Contact.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
});

after(async () => {
  await server.close();
  dom.window.close();
});

const NOVA_RESPOSTA_DE_IMPORTACAO = { total: 100, criados: 97, erros: [
  { linha: 11, nome: 'Importada 10', motivo: 'CPF inválido: confira os 11 dígitos.' },
  { linha: 41, nome: 'Importada 40', motivo: 'Informe um e-mail válido.' },
  { linha: 78, nome: null, motivo: 'Cargo "X" não encontrado nesta empresa.' },
], credenciais: [{ linha: 2, nome: 'Importada 1', email: 'importada.1@exemplo.invalid', senha_provisoria: 'Senha-Ficticia-1' }] };

beforeEach(() => {
  dependentes = [{ id: 1, nome: 'Filha Ficticia', parentesco: 'Filho(a)', data_nascimento: '2018-05-01', cpf: '52998224725' }];
  ({ restaurar: restaurarApi, chamadas } = simularApi(({ metodo, caminho }) => {
    if (caminho.startsWith('/estrutura/cargos') || caminho.startsWith('/estrutura/departamentos')) return { corpo: [] };
    if (caminho === '/funcionarios/7/dependentes' && metodo === 'GET') return { corpo: dependentes };
    if (caminho === '/funcionarios/7/dependentes' && metodo === 'POST') {
      dependentes = [...dependentes, { id: 2, nome: 'Filho Novo', parentesco: 'Filho(a)', data_nascimento: '2020-02-02', cpf: null }];
      return { status: 201, corpo: { mensagem: 'ok', id: 2 } };
    }
    if (caminho === '/funcionarios/7/dependentes/1' && metodo === 'DELETE') {
      dependentes = dependentes.filter((d) => d.id !== 1);
      return { corpo: { mensagem: 'ok' } };
    }
    if (caminho === '/funcionarios/importar') return { corpo: NOVA_RESPOSTA_DE_IMPORTACAO };
    if (caminho === '/auth/registrar') return { status: 201, corpo: { mensagem: 'Conta criada com sucesso!' } };
    return { status: 404, corpo: { erro: 'rota inesperada no teste' } };
  }));
});

afterEach(() => {
  limparTela();
  restaurarApi();
});

const campo = (nome: string) => {
  const elemento = document.querySelector<HTMLInputElement>(`[name="${nome}"]`);
  assert.ok(elemento, `campo ${nome} não está na tela`);
  return elemento;
};

const abrirModal = (props: Partial<PropsDoModal> = {}) => render(comConsulta(
  createElement(UiProviders, null, createElement(EmployeeModal, { isOpen: true, onClose: () => {}, onSave: async () => {}, ...props })),
));

const aba = (nome: RegExp) => screen.getByRole('tab', { name: nome });

test('CPF, PIS e CEP ganham máscara ao digitar, e o formulário guarda o texto mascarado que a API normaliza', async () => {
  const salvos: Dados[] = [];
  const usuario = userEvent.setup();
  abrirModal({ onSave: async (dados) => { salvos.push(dados); } });

  await usuario.type(campo('nomeCompleto'), 'Ana Ficticia');
  await usuario.type(campo('emailPessoal'), 'ana@exemplo.invalid');
  await usuario.type(campo('senhaAcesso'), 'senha-ficticia');
  await usuario.type(campo('cep'), '66000000');
  assert.equal(campo('cep').value, '66000-000');

  await usuario.click(aba(/Documentos/i));
  await usuario.type(campo('cpf'), '52998224725');
  assert.equal(campo('cpf').value, '529.982.247-25');
  await usuario.type(campo('pis'), '12012345672');
  assert.equal(campo('pis').value, '120.12345.67-2');
  await usuario.type(campo('rg'), '1234567');
  await usuario.click(screen.getByRole('button', { name: 'Confirmar Cadastro' }));

  await waitFor(() => assert.equal(salvos.length, 1));
  assert.deepEqual(
    [salvos[0].cpf, salvos[0].pis, salvos[0].rg, salvos[0].cep],
    ['529.982.247-25', '120.12345.67-2', '1234567', '66000-000'],
  );
});

test('CPF repetido (409) reabre a aba Documentos, mostra a mensagem e leva o foco ao campo', async () => {
  const mensagem = 'Já existe um colaborador com este CPF nesta empresa.';
  const usuario = userEvent.setup();
  abrirModal({
    onSave: async () => {
      const { HttpError } = await server.ssrLoadModule('/src/services/httpClient.ts');
      throw new HttpError(mensagem, 409, { erro: mensagem, detalhes: [{ campo: 'cpf', mensagem }] });
    },
  });
  await usuario.type(campo('nomeCompleto'), 'Ana Ficticia');
  await usuario.type(campo('emailPessoal'), 'ana@exemplo.invalid');
  await usuario.type(campo('senhaAcesso'), 'senha-ficticia');
  await usuario.click(screen.getByRole('button', { name: 'Confirmar Cadastro' }));

  assert.match((await screen.findByRole('alert')).textContent ?? '', /Já existe um colaborador com este CPF/);
  assert.equal(aba(/Documentos/i).getAttribute('aria-selected'), 'true');
  assert.equal(document.activeElement, campo('cpf'));
});

test('editar mostra o CPF mascarado e, sem endereço em colunas, o endereço antigo em texto livre', async () => {
  abrirModal({ employeeToEdit: { id: '7', nomeCompleto: 'Bia Ficticia', emailPessoal: 'bia@exemplo.invalid', status: 'Ativo', cpf: '529.982.247-25', enderecoAnterior: 'Rua Velha, 10' } });
  assert.match(document.body.textContent ?? '', /Endereço anterior \(texto livre\): Rua Velha, 10/);
  await userEvent.setup().click(aba(/Documentos/i));
  assert.equal(campo('cpf').value, '529.982.247-25');
});

test('Dependentes: cadastro novo pede para salvar antes e não mostra formulário', async () => {
  await userEvent.setup().click((abrirModal(), aba(/Dependentes/i)));
  assert.ok(screen.getByText('Salve o cadastro para adicionar dependentes.'));
  assert.equal(document.querySelector('[name="dependenteNome"]'), null);
});

test('Dependentes: lista os do colaborador, inclui um novo por POST e remove outro, depois de confirmar, por DELETE', async () => {
  const usuario = userEvent.setup();
  abrirModal({ employeeToEdit: { id: '7', nomeCompleto: 'Bia Ficticia', emailPessoal: 'bia@exemplo.invalid', status: 'Ativo' } });
  await usuario.click(aba(/Dependentes/i));

  const lista = await screen.findByRole('list', { name: 'Dependentes do colaborador' });
  assert.match(lista.textContent ?? '', /Filha Ficticia/);
  assert.match(lista.textContent ?? '', /Filho\(a\) · nascimento 01\/05\/2018 · CPF 529\.982\.247-25/);

  await usuario.type(campo('dependenteNome'), 'Filho Novo');
  await usuario.type(campo('dependenteDataNascimento'), '2020-02-02');
  await usuario.click(screen.getByRole('button', { name: 'Adicionar dependente' }));
  await waitFor(() => assert.match(screen.getByRole('list', { name: 'Dependentes do colaborador' }).textContent ?? '', /Filho Novo/));
  const post = chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/funcionarios/7/dependentes');
  assert.deepEqual(post?.corpo, { nome: 'Filho Novo', parentesco: 'Filho(a)', data_nascimento: '2020-02-02', cpf: '' });
  assert.equal(campo('dependenteNome').value, '', 'o formulário limpa depois de gravar');

  await usuario.click(screen.getByRole('button', { name: 'Remover dependente Filha Ficticia' }));
  await usuario.click(await screen.findByRole('button', { name: 'Remover' }));
  await waitFor(() => assert.doesNotMatch(screen.getByRole('list', { name: 'Dependentes do colaborador' }).textContent ?? '', /Filha Ficticia/));
  assert.ok(chamadas.some((c) => c.metodo === 'DELETE' && c.caminho === '/funcionarios/7/dependentes/1'));
});

test('Dependentes: Enter no formulário inclui o dependente em vez de enviar o cadastro, e o erro da API aparece na aba', async () => {
  const salvos: Dados[] = [];
  const usuario = userEvent.setup();
  abrirModal({ employeeToEdit: { id: '7', nomeCompleto: 'Bia Ficticia', emailPessoal: 'bia@exemplo.invalid', status: 'Ativo' }, onSave: async (dados) => { salvos.push(dados); } });
  await usuario.click(aba(/Dependentes/i));
  await screen.findByRole('list', { name: 'Dependentes do colaborador' });

  await usuario.click(screen.getByRole('button', { name: 'Adicionar dependente' }));
  assert.match((await screen.findAllByRole('alert')).map((a) => a.textContent).join(' '), /Informe o nome do dependente/);

  restaurarApi();
  ({ restaurar: restaurarApi, chamadas } = simularApi(({ metodo, caminho }) => (
    metodo === 'POST' ? { status: 409, corpo: { erro: 'Este CPF já está cadastrado como dependente deste colaborador.' } }
      : caminho.endsWith('/dependentes') ? { corpo: [] } : { corpo: [] }
  )));
  await usuario.type(campo('dependenteNome'), 'Filho Repetido');
  await usuario.type(campo('dependenteDataNascimento'), '2020-02-02');
  await usuario.type(campo('dependenteCpf'), '52998224725{Enter}');
  assert.match((await screen.findAllByRole('alert')).map((a) => a.textContent).join(' '), /já está cadastrado como dependente/);
  assert.equal(salvos.length, 0, 'Enter não enviou o cadastro do colaborador');
});

// O jsdom não conta o arquivo posto por userEvent.upload na validação do `required` e barraria o clique no botão:
// o envio é disparado no formulário, como o navegador o faria com o arquivo escolhido.
const enviarFormulario = () => fireEvent.submit(document.querySelector('form') as HTMLFormElement);

const arquivoCsv = (conteudo: string) => new dom.window.File([conteudo], 'planilha.csv', { type: 'text/csv' }) as unknown as File;

test('importação: envia o CSV como texto, mostra quantos entraram e as linhas recusadas com o motivo', async () => {
  const usuario = userEvent.setup();
  render(comConsulta(createElement(UiProviders, null, createElement(ImportEmployeesModal, { onClose: () => {} }))));

  assert.ok(screen.getByRole('button', { name: 'Baixar planilha modelo' }));
  enviarFormulario();
  assert.match((await screen.findByRole('alert')).textContent ?? '', /Escolha o arquivo CSV/);

  await usuario.upload(campo('arquivoCsv'), arquivoCsv('x'.repeat(2 * 1024 * 1024 + 1)));
  assert.match((await screen.findByRole('alert')).textContent ?? '', /passa de 2 MB/);

  const csv = 'nome,email\nAna,ana@exemplo.invalid\n';
  await usuario.upload(campo('arquivoCsv'), arquivoCsv(csv));
  enviarFormulario();

  await screen.findByText(/97 de 100 colaboradores importados\. 3 linhas ficaram de fora\./);
  const envio = chamadas.find((c) => c.caminho === '/funcionarios/importar');
  assert.equal(envio?.metodo, 'POST');
  assert.equal(envio?.corpo, csv, 'o arquivo vai como texto, sem JSON');

  const tabela = screen.getByRole('table', { name: 'Linhas recusadas e o motivo' });
  const linhas = within(tabela).getAllByRole('row').slice(1).map((linha) => [...linha.querySelectorAll('td')].map((c) => c.textContent));
  assert.deepEqual(linhas, [
    ['11', 'Importada 10', 'CPF inválido: confira os 11 dígitos.'],
    ['41', 'Importada 40', 'Informe um e-mail válido.'],
    ['78', '—', 'Cargo "X" não encontrado nesta empresa.'],
  ]);
  assert.ok(screen.getByRole('button', { name: 'Baixar senhas provisórias' }));
  assert.equal(document.body.textContent?.includes('Senha-Ficticia-1'), false, 'as senhas só saem pelo arquivo baixado, nunca na tela');
});

test('importação: erro de arquivo da API (400) aparece no modal e mantém o arquivo escolhido', async () => {
  restaurarApi();
  ({ restaurar: restaurarApi, chamadas } = simularApi(() => ({ status: 400, corpo: { erro: 'Coluna desconhecida: salario_liquido.' } })));
  const usuario = userEvent.setup();
  render(comConsulta(createElement(UiProviders, null, createElement(ImportEmployeesModal, { onClose: () => {} }))));
  await usuario.upload(campo('arquivoCsv'), arquivoCsv('nome,email,salario_liquido\nA,a@exemplo.invalid,1\n'));
  enviarFormulario();
  assert.match((await screen.findByRole('alert')).textContent ?? '', /Coluna desconhecida: salario_liquido/);
  assert.ok(screen.getByRole('button', { name: 'Importar planilha' }), 'o formulário continua aberto para tentar de novo');
});

const abrirContato = () => render(createElement(MemoryRouter, null, createElement(Contact)));

test('cadastro de empresa: pede CNPJ com máscara e confirmação de senha, e envia os dois', async () => {
  const usuario = userEvent.setup();
  abrirContato();
  for (const nome of ['cnpj', 'confirmacaoSenha']) assert.equal(campo(nome).required, true, nome);

  await usuario.type(campo('nomeAdmin'), 'Joana Ficticia');
  await usuario.type(campo('nomeEmpresa'), 'Empresa Ficticia Ltda');
  await usuario.type(campo('cnpj'), '11222333000181');
  assert.equal(campo('cnpj').value, '11.222.333/0001-81');
  await usuario.type(campo('email'), 'joana@exemplo.invalid');
  await usuario.type(campo('senha'), 'senha-ficticia');
  await usuario.type(campo('confirmacaoSenha'), 'senha-diferente');
  await usuario.click(screen.getByRole('button', { name: /Criar minha conta/ }));

  assert.equal((await screen.findByRole('alert')).textContent, 'A confirmação da senha não confere.');
  assert.equal(chamadas.filter((c) => c.caminho === '/auth/registrar').length, 0, 'senha diferente não chega à API');

  await usuario.clear(campo('confirmacaoSenha'));
  await usuario.type(campo('confirmacaoSenha'), 'senha-ficticia');
  await usuario.click(screen.getByRole('button', { name: /Criar minha conta/ }));
  await waitFor(() => assert.ok(chamadas.some((c) => c.caminho === '/auth/registrar')));
  assert.deepEqual(chamadas.find((c) => c.caminho === '/auth/registrar')?.corpo, {
    nomeEmpresa: 'Empresa Ficticia Ltda', cnpj: '11.222.333/0001-81', nomeAdmin: 'Joana Ficticia', email: 'joana@exemplo.invalid',
    senha: 'senha-ficticia', confirmacaoSenha: 'senha-ficticia',
  });
});

test('cadastro de empresa: o erro de CNPJ da API aparece no formulário', async () => {
  restaurarApi();
  ({ restaurar: restaurarApi, chamadas } = simularApi(() => resposta({ status: 400, corpo: { erro: 'CNPJ inválido: confira os 14 dígitos.' } })));
  const usuario = userEvent.setup();
  abrirContato();
  await usuario.type(campo('nomeAdmin'), 'Joana Ficticia');
  await usuario.type(campo('nomeEmpresa'), 'Empresa Ficticia Ltda');
  await usuario.type(campo('cnpj'), '11111111111111');
  await usuario.type(campo('email'), 'joana@exemplo.invalid');
  await usuario.type(campo('senha'), 'senha-ficticia');
  await usuario.type(campo('confirmacaoSenha'), 'senha-ficticia');
  await usuario.click(screen.getByRole('button', { name: /Criar minha conta/ }));
  assert.match((await screen.findByRole('alert')).textContent ?? '', /CNPJ inválido/);
});
