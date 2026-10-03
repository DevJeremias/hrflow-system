// B-13 na tela de colaboradores: inativar/desligar com data e motivo, reativar, redefinir a senha e
// excluir só o cadastro sem movimento. Roda no jsdom contra uma API simulada (sem navegador).
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { dom } from './support/jsdom.ts';
import { createElement, act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createServer, type ViteDevServer } from 'vite';

const CARGOS = [{ id: 1, nome: 'Desenvolvedor(a)', departamento_id: 1, departamento_nome: 'TI', nivel: 'Pleno', salario_base: '8000.00' }];
const DEPARTAMENTOS = [{ id: 1, nome: 'TI', sigla: 'TI' }];

type Chamada = { metodo: string; caminho: string; corpo?: Record<string, unknown> };
type Resposta = { status: number; corpo?: unknown };

let server: ViteDevServer;
let Employees: ComponentType;
let UiProviders: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;

let chamadas: Chamada[] = [];
let funcionarios: Record<string, unknown>[] = [];
let respostaDaGravacao: () => Promise<Resposta> | Resposta;
let confirmacoes: string[] = [];
let montados: { host: HTMLElement; root: Root }[] = [];

const json = (status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) =>
  new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', ...cabecalhos } });

const colaborador = (extra: Record<string, unknown> = {}) => ({
  id: 7, nome: 'Bia Ficticia', email: 'bia@exemplo.invalid', cargo_id: 1, cargo_nome: 'Desenvolvedor(a)', departamento_id: 1,
  departamento_nome: 'TI', nivel: 'Pleno', salario_base: '5000.00', status: 'Ativo', tipo_contrato: 'CLT', data_admissao: '2024-01-02',
  data_desligamento: null, motivo_desligamento: null, usuario_perfil: 'Colaborador', tem_movimento: false, ...extra,
});

before(async () => {
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true }, appType: 'custom' });
  ({ default: Employees } = await server.ssrLoadModule('/src/pages/Admin/Employees.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  dom.window.confirm = (mensagem?: string) => { confirmacoes.push(String(mensagem)); return true; };
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = String(entrada).replace(/^\/api/, '');
    const metodo = (init?.method ?? 'GET').toUpperCase();
    chamadas.push({ metodo, caminho, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
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
  respostaDaGravacao = () => ({ status: 200, corpo: { mensagem: 'ok' } });
});

const esperar = (ms = 0) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

const montar = async (Tela: ComponentType) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  montados.push({ host, root });
  await act(async () => { root.render(createElement(UiProviders, null, createElement(Tela))); });
  await esperar();
  // O modal vive em um contêiner no <body>, fora do host: as consultas partem do documento.
  return document.body;
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

const botao = (host: ParentNode, texto: RegExp) => {
  const encontrado = [...host.querySelectorAll('button')].find((candidato) => texto.test(candidato.textContent ?? ''));
  assert.ok(encontrado, `botão ${texto} não está na tela`);
  return encontrado;
};

// Cada ação é um IconButton cujo nome acessível termina no nome do colaborador.
const NOME_DA_ACAO: Record<string, string> = {
  'Editar Colaborador': 'Editar colaborador', 'Redefinir Senha': 'Redefinir senha de', 'Inativar ou Desligar': 'Inativar ou desligar',
  'Excluir Cadastro': 'Excluir cadastro de', 'Reativar Colaborador': 'Reativar colaborador',
};
const acao = (host: ParentNode, titulo: string) => host.querySelector<HTMLButtonElement>(`button[aria-label^="${NOME_DA_ACAO[titulo]}"]`);
const gravacoes = () => chamadas.filter((chamada) => chamada.metodo !== 'GET');
const dialogo = (host: ParentNode) => host.querySelector<HTMLElement>('[role="dialog"]')!;
const enviar = async (host: HTMLElement, selector = '[role="dialog"] form') => {
  await act(async () => { host.querySelector(selector)!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await esperar();
};

test('cada linha oferece as ações do ciclo de vida e a lixeira só existe sem movimento', async () => {
  funcionarios = [colaborador({ id: 1 }), colaborador({ id: 2, nome: 'Caio Ficticio', tem_movimento: true })];
  const host = await montar(Employees);
  const [primeira, segunda] = [...host.querySelectorAll('tbody tr')];
  for (const titulo of ['Editar Colaborador', 'Redefinir Senha', 'Inativar ou Desligar', 'Excluir Cadastro']) {
    assert.ok(acao(primeira, titulo), `${titulo} na linha sem movimento`);
  }
  assert.equal(acao(segunda, 'Excluir Cadastro'), null, 'com ponto registrado não se exclui');
  assert.ok(acao(segunda, 'Inativar ou Desligar'));
});

test('a linha de RH ou Administrador só oferece editar', async () => {
  funcionarios = [colaborador({ usuario_perfil: 'RH' })];
  const host = await montar(Employees);
  assert.ok(acao(host, 'Editar Colaborador'));
  for (const titulo of ['Redefinir Senha', 'Inativar ou Desligar', 'Excluir Cadastro', 'Reativar Colaborador']) {
    assert.equal(acao(host, titulo), null, titulo);
  }
});

test('desligar explica o efeito, exige data e motivo e envia PATCH com os dois', async () => {
  funcionarios = [colaborador()];
  const host = await montar(Employees);
  await clicar(acao(host, 'Inativar ou Desligar')!);

  const janela = dialogo(host);
  assert.match(janela.textContent ?? '', /perde o acesso ao sistema agora/);
  assert.match(janela.textContent ?? '', /mês do desligamento/);
  assert.equal(campo<HTMLInputElement>(host, 'dataDesligamento').required, true);
  assert.equal(campo<HTMLInputElement>(host, 'motivoDesligamento').required, true);

  await digitar(host, 'dataDesligamento', '2026-09-30');
  await digitar(host, 'motivoDesligamento', '  Pedido de demissão ');
  await enviar(host);

  assert.deepEqual(gravacoes(), [{ metodo: 'PATCH', caminho: '/funcionarios/7/status', corpo: { status: 'Inativo', data_desligamento: '2026-09-30', motivo_desligamento: 'Pedido de demissão' } }]);
  assert.equal(host.querySelector('[role="dialog"]'), null, 'o modal fecha ao concluir');
  assert.ok(chamadas.filter((c) => c.metodo === 'GET' && c.caminho.startsWith('/funcionarios')).length >= 2, 'a lista é recarregada');
});

test('erro da API ao desligar aparece no modal, que continua aberto com o que foi digitado', async () => {
  funcionarios = [colaborador()];
  respostaDaGravacao = () => ({ status: 400, corpo: { erro: 'A data do desligamento não pode ser anterior à data de admissão.' } });
  const host = await montar(Employees);
  await clicar(acao(host, 'Inativar ou Desligar')!);
  await digitar(host, 'motivoDesligamento', 'Fim do contrato');
  await enviar(host);

  assert.match(dialogo(host).querySelector('[role="alert"]')?.textContent ?? '', /anterior à data de admissão/);
  assert.equal(campo<HTMLInputElement>(host, 'motivoDesligamento').value, 'Fim do contrato');
});

test('quem está inativo mostra desde quando e por quê, e oferece reativar em vez de inativar', async () => {
  funcionarios = [colaborador({ status: 'Inativo', data_desligamento: '2026-09-30', motivo_desligamento: 'Pedido de demissão' })];
  const host = await montar(Employees);
  assert.match(host.querySelector('tbody')!.textContent ?? '', /Desde 30\/09\/2026 · Pedido de demissão/);
  assert.equal(acao(host, 'Inativar ou Desligar'), null);
  assert.equal(acao(host, 'Redefinir Senha'), null, 'sem acesso ativo não há senha a redefinir');

  await clicar(acao(host, 'Reativar Colaborador')!);
  assert.match(dialogo(host).textContent ?? '', /volta a entrar no sistema/);
  await enviar(host);
  assert.deepEqual(gravacoes(), [{ metodo: 'PATCH', caminho: '/funcionarios/7/status', corpo: { status: 'Ativo' } }]);
});

test('redefinir a senha mostra a senha provisória uma vez e não recarrega a lista por baixo', async () => {
  funcionarios = [colaborador()];
  respostaDaGravacao = () => ({ status: 200, corpo: { senhaProvisoria: 'Abcd2345Efgh', mensagem: 'ok' } });
  const host = await montar(Employees);
  await clicar(acao(host, 'Redefinir Senha')!);
  assert.match(dialogo(host).textContent ?? '', /uma única vez/);
  assert.equal(host.querySelector('[data-testid="temporary-password"]'), null, 'nada é gerado antes de confirmar');

  await enviar(host);
  assert.deepEqual(gravacoes(), [{ metodo: 'POST', caminho: '/funcionarios/7/redefinir-senha', corpo: undefined }]);
  assert.equal(host.querySelector('[data-testid="temporary-password"]')!.textContent, 'Abcd2345Efgh');
  assert.match(dialogo(host).textContent ?? '', /não será exibida de novo/);

  await clicar(botao(dialogo(host), /Concluir/));
  assert.equal(host.querySelector('[role="dialog"]'), null);
  assert.equal(host.textContent?.includes('Abcd2345Efgh'), false, 'a senha some da tela ao concluir');
});

test('excluir diz que é definitivo e só então envia o DELETE', async () => {
  funcionarios = [colaborador()];
  const host = await montar(Employees);
  await clicar(acao(host, 'Excluir Cadastro')!);
  assert.match(dialogo(host).textContent ?? '', /para sempre/);
  assert.match(dialogo(host).textContent ?? '', /inativado, nunca excluído/);
  assert.deepEqual(gravacoes(), []);

  await enviar(host);
  assert.deepEqual(gravacoes(), [{ metodo: 'DELETE', caminho: '/funcionarios/7', corpo: undefined }]);
  assert.deepEqual(confirmacoes, [], 'sem window.confirm: a confirmação é o próprio modal');
});

test('excluir quem ganhou ponto no meio tempo mostra o 409 da API e nada some', async () => {
  funcionarios = [colaborador()];
  respostaDaGravacao = () => ({ status: 409, corpo: { erro: 'Este colaborador tem registros de ponto e não pode ser excluído. Inative-o para preservar o histórico.' } });
  const host = await montar(Employees);
  await clicar(acao(host, 'Excluir Cadastro')!);
  await enviar(host);
  assert.match(dialogo(host).querySelector('[role="alert"]')?.textContent ?? '', /Inative-o para preservar o histórico/);
  assert.ok(host.querySelector('tbody tr'));
});

test('Escape fecha o modal e o botão Cancelar também, sem enviar nada', async () => {
  funcionarios = [colaborador()];
  const host = await montar(Employees);
  await clicar(acao(host, 'Excluir Cadastro')!);
  await act(async () => { dialogo(host).dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  assert.equal(host.querySelector('[role="dialog"]'), null);

  await clicar(acao(host, 'Inativar ou Desligar')!);
  await clicar(botao(dialogo(host), /Cancelar/));
  assert.equal(host.querySelector('[role="dialog"]'), null);
  assert.deepEqual(gravacoes(), []);
});

test('o modal de edição mostra a situação atual e permite Férias: o PUT segue sem status e o PATCH traz o novo', async () => {
  funcionarios = [colaborador()];
  const host = await montar(Employees);
  await clicar(acao(host, 'Editar Colaborador')!);
  await esperar();
  await clicar(botao(host, /Contrato/i));

  assert.equal(campo<HTMLSelectElement>(host, 'status').value, 'Ativo');
  assert.deepEqual([...campo<HTMLSelectElement>(host, 'status').options].map((o) => o.value), ['Ativo', 'Férias', 'Inativo']);
  await escolher(host, 'status', 'Férias');
  await enviar(host, 'form');

  const [put, patch] = gravacoes();
  assert.equal(put.metodo, 'PUT');
  assert.equal('status' in (put.corpo ?? {}), false, 'o status não viaja no PUT');
  assert.deepEqual(patch, { metodo: 'PATCH', caminho: '/funcionarios/7/status', corpo: { status: 'Férias' } });
});

test('escolher Inativo no modal de edição pede data e motivo do desligamento', async () => {
  funcionarios = [colaborador()];
  const host = await montar(Employees);
  await clicar(acao(host, 'Editar Colaborador')!);
  await esperar();
  await clicar(botao(host, /Contrato/i));
  assert.equal(host.querySelector('[name="dataDesligamento"]'), null);

  await escolher(host, 'status', 'Inativo');
  assert.equal(campo<HTMLInputElement>(host, 'dataDesligamento').required, true);
  await digitar(host, 'dataDesligamento', '2026-09-30');
  await digitar(host, 'motivoDesligamento', 'Fim do contrato');
  await enviar(host, 'form');

  const [put, patch] = gravacoes();
  assert.equal(put.metodo, 'PUT');
  assert.deepEqual(patch.corpo, { status: 'Inativo', data_desligamento: '2026-09-30', motivo_desligamento: 'Fim do contrato' });
});

test('salvar sem mexer na situação não chama o PATCH', async () => {
  funcionarios = [colaborador()];
  const host = await montar(Employees);
  await clicar(acao(host, 'Editar Colaborador')!);
  await esperar();
  await enviar(host, 'form');
  assert.deepEqual(gravacoes().map((g) => g.metodo), ['PUT']);
});
