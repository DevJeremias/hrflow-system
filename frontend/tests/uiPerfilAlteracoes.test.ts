// B-22: no perfil o colaborador grava telefone e foto na hora e pede nome, e-mail, endereço e dados bancários
// (o RH aprova); o Administrador grava tudo direto; trocar o e-mail pede a senha atual. A aba Privacidade mostra o
// encarregado da empresa. Montado com o Vite e uma API falsa.
import { after, afterEach, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { act, botaoPorTexto, clicar, createElement, desmontarTudo, dom, esperar, iniciarVite, montar } from './support/ui.ts';
import { novoQueryClient } from './support/consulta.ts';
import type { ComponentType } from 'react';
import type { ViteDevServer } from 'vite';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });

let server: ViteDevServer;
let Profile: ComponentType;
let AuthProvider: ComponentType<{ children: unknown }>;
let UiProviders: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;

interface Chamada { metodo: string; caminho: string; corpo?: Record<string, unknown> }
let chamadas: Chamada[] = [];
let perfilDaSessao: 'Colaborador' | 'Administrador' = 'Colaborador';
let resposta: Record<string, () => Response> = {};
let pedidos: unknown[] = [];

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

const PERFIL = {
  perfil: 'Colaborador', vinculado: true, nome: 'Caio Ficticio', email: 'caio@exemplo.invalid', avatar: null, telefone: '91999990000', cpf: null, data_nascimento: null,
  data_admissao: '2024-01-10', endereco: 'Rua Antiga, 1', tipo_contrato: 'CLT', nivel: 'Pleno', banco: 'Banco Ficticio', agencia: '0001', conta: '12345-6',
  tipo_conta: 'Corrente', cargo: 'Analista', departamento: 'TI', encarregado: { nome: 'Enzo Encarregado', email: 'encarregado@exemplo.invalid' },
};

before(async () => {
  document.cookie = 'hrflow_csrf=token-ficticio; Path=/';
  server = await iniciarVite();
  ({ default: Profile } = await server.ssrLoadModule('/src/pages/Portal/Profile.tsx'));
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = new URL(String(entrada), 'http://localhost').pathname.replace(/^\/api/, '');
    const metodo = (init?.method ?? 'GET').toUpperCase();
    chamadas.push({ metodo, caminho, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    const chave = `${metodo} ${caminho}`;
    if (resposta[chave]) return resposta[chave]();
    if (caminho === '/auth/sessao') return json({ id: 3, nome: 'Caio Ficticio', perfil: perfilDaSessao, empresa_nome: 'Empresa Ficticia Alfa Ltda', funcionario_id: perfilDaSessao === 'Colaborador' ? 7 : null, avatar: null });
    if (caminho === '/perfil/meus-dados') return json({ ...PERFIL, perfil: perfilDaSessao });
    if (caminho === '/solicitacoes-alteracao/minhas') return json(pedidos);
    return json({ erro: 'rota inesperada no teste' }, 404);
  }) as typeof fetch;
});
after(async () => { globalThis.fetch = originalFetch; await server.close(); dom.window.close(); });
beforeEach(() => {
  chamadas = [];
  pedidos = [];
  perfilDaSessao = 'Colaborador';
  resposta = {
    'PUT /perfil/meus-dados': () => json({ mensagem: 'ok', sessaoEncerrada: false }),
    'POST /solicitacoes-alteracao': () => json({ id: 1, status: 'pendente' }, 201),
    'POST /auth/logout': () => new Response(null, { status: 204 }),
  };
});
afterEach(desmontarTudo);

const abrir = async () => {
  const host = await montar(createElement(QueryClientProvider, { client: novoQueryClient() },
    createElement(MemoryRouter, null, createElement(AuthProvider, null, createElement(UiProviders, null, createElement(Profile))))));
  for (let i = 0; i < 4; i += 1) await esperar(20);
  return host;
};

const digitar = async (campo: HTMLInputElement, valor: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(campo, valor);
    campo.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};
const campo = (host: HTMLElement, nome: string) => host.querySelector<HTMLInputElement>(`[name="${nome}"]`)!;
const enviar = async (host: HTMLElement) => {
  await act(async () => { host.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await esperar(40);
};
const gravacoes = () => chamadas.filter((c) => c.metodo !== 'GET');

test('o colaborador avisa que nome, e-mail, endereço e banco dependem de aprovação do RH', async () => {
  const host = await abrir();
  await clicar(botaoPorTexto(host, /Editar Dados/));
  assert.match(host.textContent ?? '', /Nome, e-mail de acesso, endereço e dados bancários\s*passam por aprovação do RH/);
  assert.ok(campo(host, 'endereco') && campo(host, 'banco') && campo(host, 'agencia') && campo(host, 'conta'), 'os campos de endereço e banco estão no formulário');
});

test('nome e banco viram um pedido, telefone vai direto: o PUT leva só o telefone e o POST só o que precisa de aprovação', async () => {
  const host = await abrir();
  await clicar(botaoPorTexto(host, /Editar Dados/));
  await digitar(campo(host, 'name'), 'Caio Ficticio Lima');
  await digitar(campo(host, 'telefone'), '91988887777');
  await digitar(campo(host, 'banco'), 'Banco Novo');
  await enviar(host);

  assert.deepEqual(gravacoes().map((c) => [c.metodo, c.caminho]), [['POST', '/solicitacoes-alteracao'], ['PUT', '/perfil/meus-dados']]);
  assert.deepEqual(gravacoes()[0].corpo, { nome: 'Caio Ficticio Lima', banco: 'Banco Novo' });
  assert.deepEqual(gravacoes()[1].corpo, { telefone: '91988887777' });
  assert.match(document.querySelector('[role="status"]')?.textContent ?? '', /Solicitação enviada\. Os dados atuais continuam valendo até a decisão/);
  assert.equal(host.textContent?.includes('Caio Ficticio Lima'), false, 'o nome em tela continua o atual até a aprovação');
});

test('só o telefone muda: nenhum pedido é criado', async () => {
  const host = await abrir();
  await clicar(botaoPorTexto(host, /Editar Dados/));
  await digitar(campo(host, 'telefone'), '91977776666');
  await enviar(host);
  assert.deepEqual(gravacoes().map((c) => [c.metodo, c.caminho, c.corpo]), [['PUT', '/perfil/meus-dados', { telefone: '91977776666' }]]);
  assert.match(document.querySelector('[role="status"]')?.textContent ?? '', /Dados atualizados/);
});

test('sem mudar nada, salvar só fecha o formulário', async () => {
  const host = await abrir();
  await clicar(botaoPorTexto(host, /Editar Dados/));
  await enviar(host);
  assert.deepEqual(gravacoes(), []);
  assert.ok(botaoPorTexto(host, /Editar Dados/));
});

test('trocar o e-mail pede a senha atual, não envia sem ela e a manda junto do pedido', async () => {
  const host = await abrir();
  await clicar(botaoPorTexto(host, /Editar Dados/));
  assert.equal(campo(host, 'senhaAtual'), null, 'o campo só aparece quando o e-mail muda');
  await digitar(campo(host, 'email'), 'caio.novo@exemplo.invalid');
  const senha = campo(host, 'senhaAtual');
  assert.ok(senha && senha.type === 'password' && senha.getAttribute('autocomplete') === 'current-password');
  assert.ok(host.querySelector(`label[for="${senha.id}"]`));

  await enviar(host);
  assert.deepEqual(gravacoes(), [], 'sem a senha nada é enviado');
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /senha atual/);

  await digitar(campo(host, 'senhaAtual'), 'senha-ficticia-1');
  await enviar(host);
  assert.deepEqual(gravacoes().map((c) => [c.metodo, c.caminho, c.corpo]), [['POST', '/solicitacoes-alteracao', { email: 'caio.novo@exemplo.invalid', senhaAtual: 'senha-ficticia-1' }]]);
});

test('a recusa do pedido (senha errada) aparece no formulário e o formulário continua aberto', async () => {
  resposta['POST /solicitacoes-alteracao'] = () => json({ erro: 'A senha atual está incorreta.' }, 400);
  const host = await abrir();
  await clicar(botaoPorTexto(host, /Editar Dados/));
  await digitar(campo(host, 'email'), 'caio.novo@exemplo.invalid');
  await digitar(campo(host, 'senhaAtual'), 'errada');
  await enviar(host);
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /senha atual está incorreta/);
  assert.equal(chamadas.filter((c) => c.metodo === 'PUT').length, 0, 'o telefone e a foto não são gravados se o pedido falhou');
  assert.ok(campo(host, 'email'));
});

test('o Administrador grava direto: um único PUT, sem pedido, e ao trocar o e-mail a sessão é encerrada', async () => {
  perfilDaSessao = 'Administrador';
  resposta['PUT /perfil/meus-dados'] = () => json({ mensagem: 'Dados atualizados.', sessaoEncerrada: true });
  const host = await abrir();
  await clicar(botaoPorTexto(host, /Editar Dados/));
  assert.doesNotMatch(host.textContent ?? '', /passam por aprovação/);
  await digitar(campo(host, 'name'), 'Admin Novo Nome');
  await digitar(campo(host, 'email'), 'admin.novo@exemplo.invalid');
  await digitar(campo(host, 'senhaAtual'), 'senha-ficticia-1');
  await enviar(host);

  const puts = gravacoes().filter((c) => c.metodo === 'PUT');
  assert.equal(puts.length, 1);
  assert.deepEqual(puts[0].corpo, { nome: 'Admin Novo Nome', email: 'admin.novo@exemplo.invalid', senhaAtual: 'senha-ficticia-1' });
  assert.equal(chamadas.filter((c) => c.caminho === '/solicitacoes-alteracao' && c.metodo === 'POST').length, 0);
  assert.ok(chamadas.some((c) => c.metodo === 'POST' && c.caminho === '/auth/logout'), 'o e-mail de acesso mudou: a sessão termina');
});

test('os pedidos feitos aparecem com a situação, e o recusado mostra a resposta de quem decidiu', async () => {
  pedidos = [
    { id: 2, status: 'recusada', solicitante: { nome: 'Caio Ficticio', perfil: 'Colaborador' }, alteracoes: { banco: 'Banco X' }, anteriores: { banco: 'Banco Ficticio' }, resposta: 'Envie o comprovante.', decidido_por: 'Rita RH', decidido_em: '2026-10-03T12:00:00.000Z', criado_em: '2026-10-02T12:00:00.000Z' },
    { id: 3, status: 'pendente', solicitante: { nome: 'Caio Ficticio', perfil: 'Colaborador' }, alteracoes: { nome: 'Caio Lima' }, anteriores: { nome: 'Caio Ficticio' }, resposta: null, decidido_por: null, decidido_em: null, criado_em: '2026-10-03T12:00:00.000Z' },
    { id: 1, status: 'cancelada', solicitante: { nome: 'Caio Ficticio', perfil: 'Colaborador' }, alteracoes: { nome: 'Caio Antigo' }, anteriores: { nome: 'Caio Ficticio' }, resposta: null, decidido_por: null, decidido_em: null, criado_em: '2026-10-01T12:00:00.000Z' },
  ];
  const host = await abrir();
  const texto = host.textContent ?? '';
  assert.match(texto, /Seus pedidos de alteração/);
  assert.match(texto, /Aguardando decisão/);
  assert.match(texto, /Os dados atuais continuam valendo até a decisão/);
  assert.match(texto, /Recusado por Rita RH:\s*Envie o comprovante\./);
  assert.doesNotMatch(texto, /Caio Antigo/, 'o pedido substituído não aparece');
});

test('a aba Privacidade mostra o encarregado da empresa com o e-mail clicável e a política', async () => {
  const host = await abrir();
  await clicar([...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((aba) => aba.textContent === 'Privacidade')!);
  assert.match(host.textContent ?? '', /Enzo Encarregado/);
  assert.equal(host.querySelector('a[href^="mailto:"]')?.getAttribute('href'), 'mailto:encarregado@exemplo.invalid');
  assert.equal([...host.querySelectorAll('a')].find((a) => /Política de Privacidade/.test(a.textContent ?? ''))?.getAttribute('href'), '/privacidade');
});

test('sem encarregado indicado a aba manda falar com o RH', async () => {
  resposta['GET /perfil/meus-dados'] = () => json({ ...PERFIL, encarregado: null });
  const host = await abrir();
  await clicar([...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((aba) => aba.textContent === 'Privacidade')!);
  assert.match(host.textContent ?? '', /ainda não indicou um encarregado/);
  assert.equal(host.querySelector('a[href^="mailto:"]'), null);
});
