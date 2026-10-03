// Menu e botões por perfil (docs/permissoes.md). Funções puras: rodam no Node, sem navegador nem servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuDoUsuario } from '../src/utils/menu.ts';
import { podeGerirCadastro } from '../src/utils/permissoes.ts';
import { temAreaPessoal } from '../src/utils/sessao.ts';

const rotulos = (user: Parameters<typeof menuDoUsuario>[0], opcoes?: Parameters<typeof menuDoUsuario>[1]) =>
  menuDoUsuario(user, opcoes).flatMap((secao) => secao.itens.map((item) => item.label));

test('o Administrador vê toda a gestão e os acessos; sem cadastro não vê ponto nem holerite', () => {
  assert.deepEqual(rotulos({ role: 'Administrador', funcionarioId: null }), [
    'Dashboard', 'Colaboradores', 'Depto & Cargos', 'Folha de Pagamento', 'Empresa', 'Gestão de Ponto', 'Relatórios', 'Usuários', 'Meu Perfil',
  ]);
});

test('o RH não vê estrutura nem usuários, e com cadastro ganha Meu ponto e Meu holerite', () => {
  assert.deepEqual(rotulos({ role: 'RH', funcionarioId: 1 }), [
    'Dashboard', 'Colaboradores', 'Folha de Pagamento', 'Empresa', 'Gestão de Ponto', 'Relatórios', 'Meu ponto', 'Meu holerite', 'Meu Perfil',
  ]);
  assert.deepEqual(rotulos({ role: 'RH', funcionarioId: null }), ['Dashboard', 'Colaboradores', 'Folha de Pagamento', 'Empresa', 'Gestão de Ponto', 'Relatórios', 'Meu Perfil']);
});

test('o Administrador com cadastro também tem Meu ponto e Meu holerite', () => {
  const itens = rotulos({ role: 'Administrador', funcionarioId: 7 });
  assert.ok(itens.includes('Meu ponto') && itens.includes('Meu holerite') && itens.includes('Usuários'));
});

test('o Colaborador só vê a própria área, e Solicitações fica fora até haver backend', () => {
  assert.deepEqual(rotulos({ role: 'Colaborador', funcionarioId: 2 }), ['Meu ponto', 'Meu holerite', 'Meus Dados']);
  assert.deepEqual(rotulos({ role: 'Colaborador', funcionarioId: 2 }, { solicitacoes: true }), ['Meu ponto', 'Meu holerite', 'Minhas Solicitações', 'Meus Dados']);
});

test('as rotas do menu de cada perfil apontam para áreas que ele alcança', () => {
  const caminhos = (role: 'Administrador' | 'RH' | 'Colaborador') =>
    menuDoUsuario({ role, funcionarioId: 1 }).flatMap((secao) => secao.itens.map((item) => item.path));
  assert.ok(caminhos('RH').every((caminho) => !['/admin/estrutura', '/admin/usuarios'].includes(caminho)));
  assert.ok(caminhos('Colaborador').every((caminho) => caminho.startsWith('/meu-painel')));
});

test('a área pessoal é de quem tem cadastro, em qualquer perfil, e do Colaborador sempre', () => {
  assert.equal(temAreaPessoal({ role: 'RH', funcionarioId: 1 }), true);
  assert.equal(temAreaPessoal({ role: 'Administrador', funcionarioId: 1 }), true);
  assert.equal(temAreaPessoal({ role: 'Administrador', funcionarioId: null }), false);
  assert.equal(temAreaPessoal({ role: 'RH', funcionarioId: null }), false);
  assert.equal(temAreaPessoal({ role: 'Colaborador', funcionarioId: null }), true);
});

test('o RH não alcança o próprio cadastro nem o de RH ou Administrador; o Administrador alcança todos', () => {
  const rita = { role: 'RH' as const, funcionarioId: 1 };
  assert.equal(podeGerirCadastro(rita, { id: '1', perfilAcesso: 'RH' }), false);
  assert.equal(podeGerirCadastro(rita, { id: '2', perfilAcesso: 'RH' }), false);
  assert.equal(podeGerirCadastro(rita, { id: '3', perfilAcesso: 'Administrador' }), false);
  assert.equal(podeGerirCadastro(rita, { id: '4', perfilAcesso: 'Colaborador' }), true);
  assert.equal(podeGerirCadastro(rita, { id: '5', perfilAcesso: '' }), true);

  const admin = { role: 'Administrador' as const, funcionarioId: null };
  assert.equal(podeGerirCadastro(admin, { id: '2', perfilAcesso: 'RH' }), true);
  assert.equal(podeGerirCadastro(null, { id: '2' }), false);
});
