// Formulários e modais do Portal do Colaborador: nomes, foco, teclado e feedback por toast (nada de alert nativo).
import { after, afterEach, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, botaoPorTexto, clicar, createElement, desmontarTudo, dom, esperar, iniciarVite, montar, porRole, teclar } from './support/ui.ts';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import type { ViteDevServer } from 'vite';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });

let server: ViteDevServer;
let Requests: ComponentType;
let Profile: ComponentType;
let EmployeeDashboard: ComponentType;
let AuthProvider: ComponentType<{ children: unknown }>;
let UiProviders: ComponentType<{ children: unknown }>;
const originalFetch = globalThis.fetch;

type Chamada = { metodo: string; caminho: string };
let chamadas: Chamada[] = [];
let respostaDaJustificativa: () => Response;
let respostaDoRegistro: () => Response;
let alertasNativos: string[] = [];

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

const HOJE = new Date().toISOString().slice(0, 10);
const DIA = { id: HOJE, date: HOJE, entry: '08:00', lunchOut: '12:00', lunchIn: '13:00', exit: '17:00', totalHours: '08:00', status: 'OK', note: '', negativeAdjust: '00:00', positiveAdjust: '00:00' };
const PERFIL = {
  perfil: 'Colaborador', vinculado: true, nome: 'Caio Ficticio', email: 'caio@exemplo.invalid', avatar: null, telefone: '91999990000', cpf: null, data_nascimento: null,
  data_admissao: '2024-01-10', endereco: null, tipo_contrato: 'CLT', nivel: 'Pleno', banco: 'Banco Ficticio', agencia: '0001', conta: '12345-6', tipo_conta: 'Corrente', cargo: 'Analista', departamento: 'TI',
};

before(async () => {
  document.cookie = 'hrflow_csrf=token-ficticio; Path=/';
  server = await iniciarVite();
  Requests = (await server.ssrLoadModule('/src/pages/Portal/Requests.tsx')).default;
  Profile = (await server.ssrLoadModule('/src/pages/Portal/Profile.tsx')).default;
  EmployeeDashboard = (await server.ssrLoadModule('/src/pages/Portal/EmployeeDashboard.tsx')).default;
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
  ({ default: UiProviders } = await server.ssrLoadModule('/src/components/ui/UiProviders.tsx'));
  dom.window.alert = (mensagem?: string) => { alertasNativos.push(String(mensagem)); };
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = new URL(String(entrada), 'http://localhost').pathname.replace(/^\/api/, '');
    const metodo = (init?.method ?? 'GET').toUpperCase();
    chamadas.push({ metodo, caminho });
    if (caminho === '/auth/sessao') return json({ id: 3, nome: 'Caio Ficticio', perfil: 'Colaborador', empresa_nome: 'Empresa Ficticia Alfa Ltda', funcionario_id: 7, avatar: null });
    if (caminho === '/perfil/meus-dados') return json(PERFIL);
    if (caminho === '/solicitacoes/minhas') return json([]);
    if (caminho.startsWith('/ponto/hoje/')) return json([]);
    if (caminho.startsWith('/ponto/historico/')) return json([DIA]);
    if (caminho.startsWith('/ponto/totais/')) return json({ totals: [], monthlySummary: null });
    if (caminho === '/ponto/registrar') return respostaDoRegistro();
    if (caminho.startsWith('/ponto/justificativa/')) return respostaDaJustificativa();
    return json({ erro: 'rota inesperada no teste' }, 404);
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
});

beforeEach(() => {
  chamadas = [];
  alertasNativos = [];
  respostaDaJustificativa = () => new Response(null, { status: 204 });
  respostaDoRegistro = () => json({ id: 1, type: 'Entrada', time: '08:00', date: HOJE }, 201);
  Object.defineProperty(dom.window.navigator, 'geolocation', { configurable: true, value: undefined });
});
afterEach(desmontarTudo);

const abrirPagina = async (Pagina: ComponentType) => {
  const host = await montar(createElement(QueryClientProvider, { client: new QueryClient() },
    createElement(MemoryRouter, null,
      createElement(AuthProvider, null, createElement(UiProviders, null, createElement(Pagina))))));
  for (let i = 0; i < 4; i += 1) await esperar(20);
  return host;
};

const dialogo = () => porRole(document, 'dialog')!;

const digitar = async (campo: HTMLInputElement | HTMLTextAreaElement, valor: string) => {
  const proto = campo.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(campo, valor);
    campo.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};

// Todo campo editável tem id, name e um <label for> que aponta para ele.
const verificarCampos = (raiz: ParentNode) => {
  const campos = [...raiz.querySelectorAll<HTMLInputElement>('input, select, textarea')].filter((c) => c.type !== 'hidden');
  assert.ok(campos.length > 0, 'há campos para verificar');
  for (const campo of campos) {
    assert.ok(campo.id, `campo sem id: ${campo.outerHTML}`);
    assert.ok(campo.name, `campo sem name: ${campo.outerHTML}`);
    assert.ok(raiz.querySelector(`label[for="${campo.id}"]`), `campo ${campo.name} sem <label for>`);
  }
  return campos;
};

test('Nova Solicitação: o modal nomeia seus campos, foca o primeiro, fecha com Esc e devolve o foco ao botão', async () => {
  const host = await abrirPagina(Requests);
  const abrir = botaoPorTexto(host, /Nova Solicitação/);
  abrir.focus();
  await clicar(abrir);
  await esperar();

  assert.equal(dialogo().getAttribute('aria-modal'), 'true');
  const campos = verificarCampos(dialogo());
  assert.deepEqual(campos.map((c) => c.name), ['type', 'startDate', 'endDate', 'observation', 'anexo']);
  assert.equal(document.activeElement, dialogo().querySelector('[name="type"]'), 'o foco entra no primeiro campo');
  assert.ok(dialogo().querySelectorAll('label').length >= 5);
  for (const rotulo of dialogo().querySelectorAll('label')) assert.ok(rotulo.getAttribute('for'), 'nenhum <label> sem for');

  await teclar(document.activeElement!, 'Escape');
  await esperar();
  assert.equal(porRole(document, 'dialog'), null);
  assert.equal(document.activeElement, abrir);
});

test('Nova Solicitação: a falha do envio vira toast de erro, o modal continua aberto e nenhum alert nativo é chamado', async () => {
  const host = await abrirPagina(Requests);
  await clicar(botaoPorTexto(host, /Nova Solicitação/));
  await esperar();
  await digitar(dialogo().querySelector('[name="startDate"]')!, '2026-11-01');
  await digitar(dialogo().querySelector('[name="endDate"]')!, '2026-11-05');
  await digitar(dialogo().querySelector('[name="observation"]')!, 'Motivo de teste');
  await act(async () => { dialogo().querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await esperar();

  assert.match(document.querySelector('[role="alert"]')!.textContent ?? '', /Solicitações ainda não estão disponíveis/);
  assert.ok(dialogo(), 'o modal segue aberto para o usuário tentar de novo');
  assert.deepEqual(alertasNativos, []);
});

test('Meus Dados: os campos de edição têm id, name, rótulo e autocomplete; sem <main> nem <label> solto', async () => {
  const host = await abrirPagina(Profile);
  assert.equal(host.querySelector('main'), null, 'o Layout é dono do <main>');
  assert.equal(document.title, 'Meus dados | HRFlow');
  await clicar(botaoPorTexto(host, /Editar Dados/));

  const campos = verificarCampos(host);
  assert.deepEqual(campos.map((c) => [c.name, c.getAttribute('autocomplete')]), [['avatar', null], ['name', 'name'], ['email', 'email'], ['telefone', 'tel']]);
  assert.equal(host.querySelector<HTMLInputElement>('[name="avatar"]')!.type, 'file');
  const idFoto = host.querySelector('[name="avatar"]')!.id;
  assert.equal(host.querySelector(`label[for="${idFoto}"]`)!.textContent, 'Alterar foto', 'o botão da câmera tem nome acessível');
});

test('Meus Dados: imagem acima de 2MB mostra toast de erro e nunca alert', async () => {
  const host = await abrirPagina(Profile);
  await clicar(botaoPorTexto(host, /Editar Dados/));
  const entrada = host.querySelector<HTMLInputElement>('[name="avatar"]')!;
  const grande = new dom.window.File([new Uint8Array(3 * 1024 * 1024)], 'foto.png', { type: 'image/png' });
  Object.defineProperty(entrada, 'files', { configurable: true, value: [grande] });
  await act(async () => { entrada.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });

  assert.equal(document.querySelector('[role="alert"]')!.textContent, 'Imagem máxima de 2MB.');
  assert.deepEqual(alertasNativos, []);
});

test('Meus Dados: as abas seguem o padrão ARIA e a de Segurança tem os autocompletes de senha', async () => {
  const host = await abrirPagina(Profile);
  const abas = [...host.querySelectorAll<HTMLElement>('[role="tab"]')];
  assert.deepEqual(abas.map((aba) => aba.textContent), ['Meus Dados', 'Vínculo e Contrato', 'Segurança']);
  const painel = porRole(host, 'tabpanel')!;
  assert.equal(abas[0].getAttribute('aria-controls'), painel.id);

  await clicar(abas[2]);
  const campos = verificarCampos(host);
  assert.deepEqual(campos.map((c) => [c.name, c.getAttribute('autocomplete')]), [['senhaAtual', 'current-password'], ['novaSenha', 'new-password'], ['confirmacaoSenha', 'new-password']]);

  await digitar(campos[0], 'atual-ficticia');
  await digitar(campos[1], 'nova-ficticia-1');
  await digitar(campos[2], 'outra-ficticia-2');
  await act(async () => { host.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  assert.equal(host.querySelector('[role="alert"]')!.textContent, 'As senhas não coincidem.');
});

test('Meus Dados: o vínculo mostra os valores em lista de definição, sem <label>', async () => {
  const host = await abrirPagina(Profile);
  await clicar(botaoPorTexto(host, /Vínculo e Contrato/));
  assert.equal(host.querySelectorAll('label').length, 0);
  const termos = [...host.querySelectorAll('dt')].map((dt) => dt.textContent);
  assert.ok(termos.includes('Data de Admissão') && termos.includes('Instituição Bancária'));
  assert.equal(host.querySelector('dt + dd')!.textContent, '10/01/2024');
});

const abrirJustificativa = async () => {
  const host = await abrirPagina(EmployeeDashboard);
  const rotulo = `Adicionar nota de ${HOJE.split('-').reverse().join('/')}`;
  const abrir = botaoPorTexto(host, new RegExp(rotulo));
  abrir.focus();
  await clicar(abrir);
  await esperar();
  return { host, abrir };
};

test('justificativa: o modal abre com o foco no texto, mantém o que foi digitado e mostra o erro dentro do diálogo', async () => {
  respostaDaJustificativa = () => json({ erro: 'Justificativa fora do prazo.' }, 400);
  await abrirJustificativa();
  const texto = dialogo().querySelector<HTMLTextAreaElement>('[name="justificativa"]')!;
  verificarCampos(dialogo());
  assert.equal(document.activeElement, texto);
  assert.equal(texto.maxLength, 1000);

  await digitar(texto, 'Fui ao médico');
  await act(async () => { dialogo().querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await esperar();

  assert.equal(dialogo().querySelector('[role="alert"]')!.textContent, 'Justificativa fora do prazo.');
  assert.equal(dialogo().querySelector<HTMLTextAreaElement>('[name="justificativa"]')!.value, 'Fui ao médico');
  assert.ok(chamadas.some((c) => c.metodo === 'PUT' && c.caminho.startsWith('/ponto/justificativa/')));
});

test('justificativa: com sucesso o modal fecha e a nota aparece na linha', async () => {
  const { host } = await abrirJustificativa();
  await digitar(dialogo().querySelector('[name="justificativa"]')!, 'Atestado');
  await act(async () => { dialogo().querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await esperar();
  assert.equal(porRole(document, 'dialog'), null);
  assert.ok(botaoPorTexto(host, /Justificativa de .*: Atestado/), 'a linha agora oferece ver a justificativa');
});

test('justificativa: Esc fecha o modal sem enviar nada', async () => {
  await abrirJustificativa();
  await teclar(document.activeElement!, 'Escape');
  await esperar();
  assert.equal(porRole(document, 'dialog'), null);
  assert.equal(chamadas.filter((c) => c.metodo === 'PUT').length, 0);
});

test('bater ponto: permissão de localização negada vira toast de erro, sem alert nativo', async () => {
  Object.defineProperty(dom.window.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (_ok: unknown, erro: () => void) => erro() },
  });
  const host = await abrirPagina(EmployeeDashboard);
  await clicar(botaoPorTexto(host, /Registrar Entrada/));
  await esperar();
  assert.match(document.querySelector('[role="alert"]')!.textContent ?? '', /permita o acesso à sua localização/);
  assert.deepEqual(alertasNativos, []);
  assert.equal(chamadas.filter((c) => c.caminho === '/ponto/registrar').length, 0);
});

test('bater ponto: navegador sem geolocalização e falha do servidor viram toast; sucesso avisa e lista o registro', async () => {
  let host = await abrirPagina(EmployeeDashboard);
  await clicar(botaoPorTexto(host, /Registrar Entrada/));
  await esperar();
  assert.match(document.querySelector('[role="alert"]')!.textContent ?? '', /não suporta geolocalização/);
  await desmontarTudo();

  Object.defineProperty(dom.window.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: -1.4, longitude: -48.5 } }) },
  });
  respostaDoRegistro = () => json({ erro: 'Fora do raio permitido.' }, 400);
  host = await abrirPagina(EmployeeDashboard);
  await clicar(botaoPorTexto(host, /Registrar Entrada/));
  await esperar();
  assert.match(document.querySelector('[role="alert"]')!.textContent ?? '', /Fora do raio permitido/);
  await desmontarTudo();

  respostaDoRegistro = () => json({ id: 1, type: 'Entrada', time: '08:00', date: HOJE }, 201);
  host = await abrirPagina(EmployeeDashboard);
  await clicar(botaoPorTexto(host, /Registrar Entrada/));
  await esperar();
  assert.match(document.querySelector('[role="status"]')!.textContent ?? '', /Ponto registrado: Entrada/);
  assert.equal(host.querySelectorAll('ol li').length, 1, 'o registro entra na lista de hoje');
  assert.deepEqual(alertasNativos, []);
});

test('bater ponto: um único <h1> e a data não é capitalizada palavra por palavra', async () => {
  const host = await abrirPagina(EmployeeDashboard);
  assert.equal(host.querySelectorAll('h1').length, 1);
  assert.match(host.querySelector('h1')!.textContent ?? '', /^Olá, Caio!$/);
  assert.equal(document.title, 'Bater ponto | HRFlow');
  assert.equal(host.querySelector('[class*="capitalize"]'), null);
  assert.equal(host.querySelector('time')?.hasAttribute('aria-live'), false, 'o relógio não é anunciado a cada segundo');
});
