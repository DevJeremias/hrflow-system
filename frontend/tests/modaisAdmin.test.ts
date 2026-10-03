import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { dom } from './support/jsdom.ts';
import { createElement, act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createServer, type ViteDevServer } from 'vite';

const EMAIL_DUPLICADO = 'Este e-mail já está registado no sistema.';
const CARGOS = [
  { id: 1, nome: 'Desenvolvedor(a)', departamento_id: 1, departamento_nome: 'TI', nivel: 'Pleno', salario_base: '8000.00' },
  { id: 2, nome: 'Analista sem salário', departamento_id: 2, departamento_nome: 'RH', nivel: null, salario_base: '0.00' },
];
const DEPARTAMENTOS = [
  { id: 1, nome: 'TI', sigla: 'TI' },
  { id: 2, nome: 'RH', sigla: 'RH' },
];

const SESSAO_DO_ADMIN = { id: 1, nome: 'Admin Ficticio', perfil: 'Administrador', empresa_nome: 'Empresa Ficticia Alfa Ltda', funcionario_id: null, avatar: null };

type Chamada = { metodo: string; caminho: string; corpo?: Record<string, unknown> };
type Resposta = { status: number; corpo?: unknown };

let server: ViteDevServer;
let AuthProvider: ComponentType<{ children: unknown }>;
let Employees: ComponentType;
let OrgStructure: ComponentType;
const originalFetch = globalThis.fetch;

let chamadas: Chamada[] = [];
let funcionarios: unknown[] = [];
// Resposta do POST/PUT que o teste quer simular; uma Promise deixa a requisição em voo.
let respostaDaGravacao: () => Promise<Resposta> | Resposta;
let confirmacoes: string[] = [];
let respostaDaConfirmacao = true;
let montados: { host: HTMLElement; root: Root }[] = [];

const json = (status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) =>
  new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', ...cabecalhos } });

before(async () => {
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true }, appType: 'custom' });
  // A tela de colaboradores decide os botões pelo perfil de quem está logado: o Administrador alcança todos os cadastros.
  document.cookie = 'hrflow_csrf=token-ficticio; Path=/';
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
  ({ default: Employees } = await server.ssrLoadModule('/src/pages/Admin/Employees.tsx'));
  ({ default: OrgStructure } = await server.ssrLoadModule('/src/pages/Admin/OrgStructure.tsx'));
  dom.window.confirm = (mensagem?: string) => { confirmacoes.push(String(mensagem)); return respostaDaConfirmacao; };
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = String(entrada).replace(/^\/api/, '');
    const metodo = (init?.method ?? 'GET').toUpperCase();
    chamadas.push({ metodo, caminho, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (caminho === '/auth/sessao') return json(200, SESSAO_DO_ADMIN);
    if (metodo !== 'GET') {
      const { status, corpo } = await respostaDaGravacao();
      return json(status, corpo);
    }
    if (caminho.startsWith('/funcionarios')) return json(200, funcionarios, { 'X-Total-Count': String(funcionarios.length) });
    if (caminho.startsWith('/estrutura/cargos')) return json(200, CARGOS);
    if (caminho.startsWith('/estrutura/departamentos')) return json(200, DEPARTAMENTOS);
    return json(404, { erro: 'rota inesperada no teste' });
  }) as typeof fetch;
});

after(async () => {
  // O AuthProvider mantém um canal entre abas aberto: desmontar libera o processo para terminar.
  for (const { root, host } of montados) { await act(async () => root.unmount()); host.remove(); }
  globalThis.fetch = originalFetch;
  await server.close();
  dom.window.close();
});

beforeEach(async () => {
  for (const { root, host } of montados) { await act(async () => root.unmount()); host.remove(); }
  montados = [];
  chamadas = [];
  funcionarios = [];
  confirmacoes = [];
  respostaDaConfirmacao = true;
  respostaDaGravacao = () => ({ status: 201, corpo: { mensagem: 'ok' } });
});

const esperar = (ms = 0) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

const montar = async (Tela: ComponentType) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  montados.push({ host, root });
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: new QueryClient() },
      createElement(MemoryRouter, null, createElement(AuthProvider, null, createElement(Tela)))));
  });
  await esperar();
  return host;
};

const campo = <T extends HTMLElement>(host: HTMLElement, nome: string) => {
  const elemento = host.querySelector<T>(`[name="${nome}"]`);
  assert.ok(elemento, `campo ${nome} não está na tela`);
  return elemento;
};

const digitar = async (host: HTMLElement, nome: string, valor: string) => {
  const input = campo<HTMLInputElement>(host, nome);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, valor);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};

const escolher = async (host: HTMLElement, nome: string, valor: string) => {
  const select = campo<HTMLSelectElement>(host, nome);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!.call(select, valor);
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
};

const clicar = async (elemento: Element) => {
  await act(async () => { elemento.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
};

const botao = (host: HTMLElement, texto: RegExp) => {
  const encontrado = [...host.querySelectorAll('button')].find((candidato) => texto.test(candidato.textContent ?? ''));
  assert.ok(encontrado, `botão ${texto} não está na tela`);
  return encontrado;
};

const abrirAba = (host: HTMLElement, nome: 'Pessoal' | 'Contrato' | 'Financeiro') => clicar(botao(host, new RegExp(nome, 'i')));

const botaoDeEnvio = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('form button[type="submit"]')!;

const abrirNovoColaborador = async (host: HTMLElement) => {
  await clicar(botao(host, /Adicionar Colaborador/));
  await esperar();
};

const preencherPessoal = async (host: HTMLElement, email = 'ana@exemplo.invalid') => {
  await digitar(host, 'nomeCompleto', 'Ana Ficticia');
  await digitar(host, 'emailPessoal', email);
  await digitar(host, 'senhaAcesso', 'senha-ficticia');
};

const gravacoes = () => chamadas.filter((chamada) => chamada.metodo !== 'GET');

test('e-mail duplicado aparece dentro do modal e reabre a aba do campo, sem perder o que foi digitado', async () => {
  respostaDaGravacao = () => ({ status: 400, corpo: { erro: EMAIL_DUPLICADO, detalhes: [{ campo: 'email', mensagem: EMAIL_DUPLICADO }] } });
  const host = await montar(Employees);
  await abrirNovoColaborador(host);
  await preencherPessoal(host);
  await abrirAba(host, 'Contrato');
  await clicar(botaoDeEnvio(host));
  await esperar();

  const alerta = host.querySelector('form [role="alert"]');
  assert.ok(alerta, 'o erro deve estar dentro do formulário do modal');
  assert.equal(alerta.textContent, EMAIL_DUPLICADO);
  const email = campo<HTMLInputElement>(host, 'emailPessoal');
  assert.equal(document.activeElement, email, 'a aba Pessoal reabre com o foco no e-mail');
  assert.equal(email.value, 'ana@exemplo.invalid');
  assert.equal(campo<HTMLInputElement>(host, 'nomeCompleto').value, 'Ana Ficticia');
  assert.equal(botaoDeEnvio(host).disabled, false, 'o botão volta a aceitar o envio');
  assert.match(botaoDeEnvio(host).textContent ?? '', /Confirmar Cadastro/);
});

test('erro sem campo identificável aparece no modal e mantém a aba atual', async () => {
  respostaDaGravacao = () => ({ status: 500, corpo: { erro: 'Erro interno ao processar o cadastro.' } });
  const host = await montar(Employees);
  await abrirNovoColaborador(host);
  await preencherPessoal(host);
  await abrirAba(host, 'Financeiro');
  await clicar(botaoDeEnvio(host));
  await esperar();

  assert.equal(host.querySelector('form [role="alert"]')?.textContent, 'Erro interno ao processar o cadastro.');
  assert.ok(host.querySelector('[name="banco"]'), 'continua na aba Financeiro');
});

test('dois cliques em 150 ms geram um único POST e o botão mostra Salvando...', async () => {
  let concluir!: (resposta: Resposta) => void;
  respostaDaGravacao = () => new Promise<Resposta>((resolve) => { concluir = resolve; });
  const host = await montar(Employees);
  await abrirNovoColaborador(host);
  await preencherPessoal(host);

  const envio = botaoDeEnvio(host);
  await clicar(envio);
  await esperar(150);
  await clicar(botaoDeEnvio(host));

  assert.equal(gravacoes().length, 1);
  assert.equal(botaoDeEnvio(host).disabled, true);
  assert.equal(botaoDeEnvio(host).textContent, 'Salvando...');

  // Enter num campo envia o formulário sem passar pelo botão: a trava vale para o envio, não só para o clique.
  const formulario = host.querySelector('form')!;
  await act(async () => { formulario.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  assert.equal(gravacoes().length, 1);

  await act(async () => { concluir({ status: 201, corpo: { mensagem: 'ok' } }); });
  await esperar();
  assert.equal(gravacoes().length, 1);
  assert.equal(host.querySelector('form'), null, 'o modal fecha depois de salvar');
});

test('o cadastro envia cargo_id e departamento_id escolhidos por id, sem chamadas extras', async () => {
  const host = await montar(Employees);
  await abrirNovoColaborador(host);
  await preencherPessoal(host);
  await abrirAba(host, 'Contrato');
  await escolher(host, 'cargoId', '2');
  await escolher(host, 'departamentoId', '1');

  const antes = chamadas.length;
  await clicar(botaoDeEnvio(host));
  await esperar();

  const [envio, ...outras] = chamadas.slice(antes);
  assert.equal(envio.metodo, 'POST');
  assert.equal(envio.caminho, '/funcionarios');
  assert.equal(envio.corpo.cargo_id, 2);
  assert.equal(envio.corpo.departamento_id, 1);
  assert.deepEqual(outras.filter((chamada) => chamada.caminho.startsWith('/estrutura')), [], 'a gravação não busca cargos nem departamentos');
});

test('o salário digitado antes de escolher o cargo é o que fica gravado', async () => {
  const host = await montar(Employees);
  await abrirNovoColaborador(host);
  await preencherPessoal(host);
  await abrirAba(host, 'Contrato');
  await digitar(host, 'salarioBase', '5000');
  await escolher(host, 'cargoId', '2');
  assert.equal(campo<HTMLInputElement>(host, 'salarioBase').value, '5000');
  await escolher(host, 'cargoId', '1');
  assert.equal(campo<HTMLInputElement>(host, 'salarioBase').value, '5000', 'cargo com salário padrão também não sobrescreve');

  await clicar(botaoDeEnvio(host));
  await esperar();
  assert.equal(gravacoes()[0].corpo.salario_base, '5000');
});

test('o cargo sugere salário, nível e setor apenas onde nada foi digitado', async () => {
  const host = await montar(Employees);
  await abrirNovoColaborador(host);
  await abrirAba(host, 'Contrato');
  await escolher(host, 'nivel', 'Sênior');
  await escolher(host, 'cargoId', '1');
  assert.equal(campo<HTMLInputElement>(host, 'salarioBase').value, '8000');
  assert.equal(campo<HTMLSelectElement>(host, 'departamentoId').value, '1');
  assert.equal(campo<HTMLSelectElement>(host, 'nivel').value, 'Sênior', 'o nível escolhido não é trocado pelo do cargo');

  await escolher(host, 'cargoId', '2');
  assert.equal(campo<HTMLInputElement>(host, 'salarioBase').value, '', 'a sugestão do cargo anterior sai junto com ele');
  assert.equal(campo<HTMLSelectElement>(host, 'departamentoId').value, '2');
});

test('o nível escolhido vai no payload', async () => {
  const host = await montar(Employees);
  await abrirNovoColaborador(host);
  await preencherPessoal(host);
  await abrirAba(host, 'Contrato');
  await escolher(host, 'nivel', 'Pleno');
  await clicar(botaoDeEnvio(host));
  await esperar();
  assert.equal(gravacoes()[0].corpo.nivel, 'Pleno');
});

test('a edição preserva cargo, setor, nível e salário já gravados e os envia por id', async () => {
  funcionarios = [{
    id: 7, nome: 'Bia Ficticia', email: 'bia@exemplo.invalid', cargo_id: 1, cargo_nome: 'Desenvolvedor(a)', departamento_id: 2,
    departamento_nome: 'RH', nivel: 'Sênior', salario_base: '5000.00', status: 'Ativo', tipo_contrato: 'CLT',
  }];
  const host = await montar(Employees);
  await clicar(host.querySelector('button[title="Editar Colaborador"]')!);
  await esperar();
  await abrirAba(host, 'Contrato');
  assert.equal(campo<HTMLSelectElement>(host, 'cargoId').value, '1');
  assert.equal(campo<HTMLSelectElement>(host, 'departamentoId').value, '2');
  await escolher(host, 'cargoId', '2');
  assert.equal(campo<HTMLInputElement>(host, 'salarioBase').value, '5000.00');
  assert.equal(campo<HTMLSelectElement>(host, 'nivel').value, 'Sênior');
  await escolher(host, 'cargoId', '1');

  await clicar(botaoDeEnvio(host));
  await esperar();
  const [envio] = gravacoes();
  assert.equal(envio.metodo, 'PUT');
  assert.equal(envio.caminho, '/funcionarios/7');
  assert.deepEqual(
    [envio.corpo.cargo_id, envio.corpo.departamento_id, envio.corpo.nivel, envio.corpo.salario_base],
    [1, 2, 'Sênior', '5000.00'],
  );
});

test('clicar fora com dados digitados pede confirmação; sem dados, fecha direto', async () => {
  const host = await montar(Employees);
  const fora = () => host.querySelector('[data-testid="employee-modal-backdrop"]')!;

  await abrirNovoColaborador(host);
  await clicar(fora());
  assert.deepEqual(confirmacoes, [], 'sem nada digitado não há o que perder');
  assert.equal(host.querySelector('form'), null);

  await abrirNovoColaborador(host);
  await digitar(host, 'nomeCompleto', 'Ana Ficticia');
  respostaDaConfirmacao = false;
  await clicar(fora());
  assert.equal(confirmacoes.length, 1);
  assert.ok(host.querySelector('form'), 'recusar a confirmação mantém o modal aberto');
  assert.equal(campo<HTMLInputElement>(host, 'nomeCompleto').value, 'Ana Ficticia');

  respostaDaConfirmacao = true;
  await clicar(fora());
  assert.equal(confirmacoes.length, 2);
  assert.equal(host.querySelector('form'), null);
});

test('departamento: dois envios geram um único POST e o erro da API aparece no modal', async () => {
  let concluir!: (resposta: Resposta) => void;
  respostaDaGravacao = () => new Promise<Resposta>((resolve) => { concluir = resolve; });
  const host = await montar(OrgStructure);
  await clicar(botao(host, /Criar Departamento/));
  await digitar(host, 'name', 'Dept Clique Duplo');
  await digitar(host, 'sigla', 'DCD');

  await clicar(botaoDeEnvio(host));
  await esperar(150);
  await clicar(botaoDeEnvio(host));
  assert.equal(gravacoes().length, 1);
  assert.equal(botaoDeEnvio(host).textContent, 'Salvando...');
  assert.equal(botaoDeEnvio(host).disabled, true);

  await act(async () => { concluir({ status: 400, corpo: { erro: 'Sigla deve ter no máximo 10 caracteres.' } }); });
  await esperar();
  assert.equal(host.querySelector('form [role="alert"]')?.textContent, 'Sigla deve ter no máximo 10 caracteres.');
  assert.equal(campo<HTMLInputElement>(host, 'name').value, 'Dept Clique Duplo');
  assert.equal(botaoDeEnvio(host).disabled, false);
  assert.equal(gravacoes().length, 1);
});
