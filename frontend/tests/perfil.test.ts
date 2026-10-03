// O que a edição do perfil muda de verdade e quem grava cada parte. Sem navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alteracoesDoPerfil, formularioDoPerfil, haAlteracoes } from '../src/utils/perfil.ts';
import type { PerfilApi } from '../src/types/api.ts';

const PERFIL: PerfilApi = {
  perfil: 'Colaborador', vinculado: true, nome: 'Caio Ficticio', email: 'caio@exemplo.invalid', avatar: null, telefone: '91999990000', cpf: null,
  data_nascimento: null, data_admissao: '2024-01-10', endereco: null, tipo_contrato: 'CLT', nivel: 'Pleno', banco: 'Banco Ficticio', agencia: '0001',
  conta: '12345-6', tipo_conta: 'Corrente', cargo: 'Analista', departamento: 'TI', encarregado: null,
};

test('sem mexer em nada não há alteração', () => {
  const alteracoes = alteracoesDoPerfil(PERFIL, formularioDoPerfil(PERFIL));
  assert.deepEqual(alteracoes, { protegidas: {} });
  assert.equal(haAlteracoes(alteracoes), false);
});

test('telefone e foto são o que o colaborador grava na hora; o resto vai para aprovação', () => {
  const form = { ...formularioDoPerfil(PERFIL), telefone: '91988887777', avatar: 'data:image/png;base64,AAAA', nome: '  Caio Novo  ', banco: 'Outro Banco' };
  assert.deepEqual(alteracoesDoPerfil(PERFIL, form), {
    protegidas: { nome: 'Caio Novo', banco: 'Outro Banco' },
    telefone: '91988887777',
    avatar: 'data:image/png;base64,AAAA',
  });
});

test('o e-mail se compara sem maiúsculas e sem espaços, como a API o grava', () => {
  assert.deepEqual(alteracoesDoPerfil(PERFIL, { ...formularioDoPerfil(PERFIL), email: ' CAIO@exemplo.invalid ' }), { protegidas: {} });
  assert.deepEqual(alteracoesDoPerfil(PERFIL, { ...formularioDoPerfil(PERFIL), email: 'Novo@Exemplo.invalid' }).protegidas, { email: 'novo@exemplo.invalid' });
});

test('apagar um dado vira o pedido de deixá-lo vazio, e apagar a foto manda texto vazio', () => {
  const alteracoes = alteracoesDoPerfil({ ...PERFIL, avatar: '/api/perfil/avatar?v=1' }, { ...formularioDoPerfil({ ...PERFIL, avatar: '/api/perfil/avatar?v=1' }), conta: '', avatar: '' });
  assert.deepEqual(alteracoes, { protegidas: { conta: '' }, avatar: '' });
});

test('quem não tem cadastro de colaborador não pede endereço nem dados bancários e não tem telefone', () => {
  const semCadastro: PerfilApi = { ...PERFIL, vinculado: false, perfil: 'Administrador', telefone: null, banco: null, agencia: null, conta: null, tipo_conta: null };
  const form = { ...formularioDoPerfil(semCadastro), endereco: 'Rua X', banco: 'Banco', telefone: '91900000000', nome: 'Admin Novo' };
  assert.deepEqual(alteracoesDoPerfil(semCadastro, form), { protegidas: { nome: 'Admin Novo' } });
});
