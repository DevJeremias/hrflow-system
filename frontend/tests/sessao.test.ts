// Funções puras da sessão do front-end (SEC-08). Rodam no Node, sem navegador nem servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerSessao, ehGestao, rotaInicial } from '../src/utils/sessao.ts';

const sessaoValida = () => ({ id: 3, nome: 'Rita RH Ficticia', perfil: 'RH', funcionario_id: 1, avatar: null });

test('lerSessao converte a resposta do servidor no usuário do front-end', () => {
  assert.deepEqual(lerSessao(sessaoValida()), { id: 3, nome: 'Rita RH Ficticia', role: 'RH', funcionarioId: 1, avatar: null });
});

test('lerSessao aceita administrador sem vínculo e avatar ausente', () => {
  const usuario = lerSessao({ id: 1, nome: 'Admin Ficticio', perfil: 'Administrador', funcionario_id: null });
  assert.equal(usuario?.funcionarioId, null);
  assert.equal(usuario?.avatar, null);
});

const invalidas: Record<string, unknown> = {
  'nada': undefined,
  'null': null,
  'texto': 'Administrador',
  'array': [sessaoValida()],
  'perfil desconhecido': { ...sessaoValida(), perfil: 'Root' },
  'perfil em minúsculas': { ...sessaoValida(), perfil: 'administrador' },
  'perfil ausente': { ...sessaoValida(), perfil: undefined },
  'id em texto': { ...sessaoValida(), id: '3' },
  'id zero': { ...sessaoValida(), id: 0 },
  'nome vazio': { ...sessaoValida(), nome: '   ' },
  'nome que não é texto': { ...sessaoValida(), nome: { $ne: '' } },
  'vínculo em texto': { ...sessaoValida(), funcionario_id: '1' },
  'vínculo ausente': { id: 3, nome: 'Rita', perfil: 'RH' },
  'avatar que não é texto': { ...sessaoValida(), avatar: 42 },
};
for (const [nome, dados] of Object.entries(invalidas)) {
  test(`lerSessao recusa ${nome}`, () => {
    assert.equal(lerSessao(dados), null);
  });
}

test('Administrador e RH gerem; Colaborador e ausência de perfil não', () => {
  assert.equal(ehGestao('Administrador'), true);
  assert.equal(ehGestao('RH'), true);
  assert.equal(ehGestao('Colaborador'), false);
  assert.equal(ehGestao(undefined), false);
});

test('a rota inicial segue o perfil', () => {
  assert.equal(rotaInicial('Administrador'), '/admin');
  assert.equal(rotaInicial('RH'), '/admin');
  assert.equal(rotaInicial('Colaborador'), '/meu-painel');
});
