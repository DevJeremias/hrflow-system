// Formulários e modais do Portal do Colaborador: nomes, foco, teclado e feedback por toast (nada de alert nativo).
import { after, afterEach, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, botaoPorTexto, clicar, createElement, desmontarTudo, dom, esperar, iniciarVite, montar, porRole, teclar } from './support/ui.ts';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { novoQueryClient } from './support/consulta.ts';
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
let respostaDoPedido: () => Response;
let minhasSolicitacoes: unknown[] = [];
const salvos: Array<{ nome: string }> = [];
// O que a API devolve em /ponto/hoje: depois de uma marcação o espelho recarrega o dia e a lista vem do servidor.
let registrosDeHoje: unknown[] = [];
let alertasNativos: string[] = [];

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

const HOJE = new Date().toISOString().slice(0, 10);
const DIA = { id: HOJE, date: HOJE, entry: '08:00', lunchOut: '12:00', lunchIn: '13:00', exit: '17:00', totalHours: '08:00', status: 'ok', open: false, delay: '00:00', note: '', noteStatus: null, noteReply: null, negativeAdjust: '00:00', positiveAdjust: '00:00' };
const JORNADA = { weeklyHours: 40, entry: '08:00', exit: '17:00', toleranceMinutes: 10 };
const TOTAIS_VAZIOS = { workloadLimit: '00:00', workloadDone: '00:00', pendingTime: '00:00', excessTime: '00:00', delayTime: '00:00', absences: 0, incompleteDays: 0 };
const SALDO = { admissao: '2024-01-15', periodoAquisitivo: { inicio: '2026-01-15', fim: '2027-01-14' }, periodosCompletos: 2, diasAdquiridos: 60, diasAprovados: 0, diasEmAnalise: 0, saldo: 60, prazoParaGozo: '2027-01-14', vencido: false };
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
  // O download vira um <a download> clicado: o jsdom não navega, e o teste só anota o nome do arquivo.
  dom.window.HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) { salvos.push({ nome: this.download }); };
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = new URL(String(entrada), 'http://localhost').pathname.replace(/^\/api/, '');
    const metodo = (init?.method ?? 'GET').toUpperCase();
    chamadas.push({ metodo, caminho });
    if (caminho === '/auth/sessao') return json({ id: 3, nome: 'Caio Ficticio', perfil: 'Colaborador', empresa_nome: 'Empresa Ficticia Alfa Ltda', funcionario_id: 7, avatar: null });
    if (caminho === '/perfil/meus-dados') return json(PERFIL);
    if (caminho === '/ausencias/minhas') return json(minhasSolicitacoes);
    if (caminho === '/ausencias/15/anexo') return json({ erro: 'Anexo não encontrado.' }, 404);
    if (caminho === '/ausencias/12/anexo') return new Response('%PDF-1.4 atestado', { status: 200, headers: { 'Content-Type': 'application/pdf' } });
    if (caminho === '/ausencias/saldo/7') return json(SALDO);
    if (caminho === '/ausencias' && metodo === 'POST') return respostaDoPedido();
    if (caminho.startsWith('/ponto/hoje/')) return json(registrosDeHoje);
    if (caminho.startsWith('/ponto/historico/')) return json([DIA]);
    if (caminho.startsWith('/ponto/totais/')) return json({ workSchedule: JORNADA, totals: [], monthlySummary: TOTAIS_VAZIOS });
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
  registrosDeHoje = [];
  respostaDoRegistro = () => json({ id: 1, type: 'Entrada', time: '08:00', date: HOJE }, 201);
  minhasSolicitacoes = [];
  salvos.length = 0;
  respostaDoPedido = () => json({ erro: 'Saldo de férias insuficiente: a solicitação tem 5 dias e há 0 disponíveis em 01/12/2026.' }, 409);
  Object.defineProperty(dom.window.navigator, 'geolocation', { configurable: true, value: undefined });
});
afterEach(desmontarTudo);

const abrirPagina = async (Pagina: ComponentType) => {
  const host = await montar(createElement(QueryClientProvider, { client: novoQueryClient() },
    createElement(MemoryRouter, null,
      createElement(AuthProvider, null, createElement(UiProviders, null, createElement(Pagina))))));
  for (let i = 0; i < 4; i += 1) await esperar(20);
  return host;
};

// 'AAAA-MM-DD' de daqui a `dias` dias em Belém: as férias não começam no passado.
const emDias = (dias: number) => new Date(Date.now() + dias * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Belem' });

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
  await digitar(dialogo().querySelector('[name="startDate"]')!, emDias(10));
  await digitar(dialogo().querySelector('[name="endDate"]')!, emDias(14));
  await digitar(dialogo().querySelector('[name="observation"]')!, 'Motivo de teste');
  await act(async () => { dialogo().querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await esperar();

  assert.match(document.querySelector('[role="alert"]')!.textContent ?? '', /Saldo de férias insuficiente/);
  assert.ok(dialogo(), 'o modal segue aberto para o usuário tentar de novo');
  assert.deepEqual(alertasNativos, []);
});

const solicitacao = (id: number, parcial: Record<string, unknown> = {}) => ({
  id, employeeId: 7, employeeName: 'Caio Ficticio', type: 'Férias', requestDate: '2026-10-03', startDate: '2026-11-02', endDate: '2026-11-11', days: 10,
  observation: 'Descanso.', hasAttachment: false, attachmentName: null, status: 'Pendente', reply: null, decidedBy: null, decidedAt: null, ...parcial,
});

const arquivoFalso = (nome: string, tipo: string, conteudo: BlobPart = '%PDF-1.4 atestado') => new dom.window.File([conteudo], nome, { type: tipo });

const anexar = async (arquivo: File) => {
  const campo = dialogo().querySelector<HTMLInputElement>('[name="anexo"]')!;
  Object.defineProperty(campo, 'files', { configurable: true, value: [arquivo] });
  await act(async () => { campo.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
};

const escolherTipo = async (tipo: string) => {
  const campo = dialogo().querySelector<HTMLSelectElement>('[name="type"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!.call(campo, tipo);
    campo.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
};

const enviar = async () => {
  await act(async () => { dialogo().querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  await esperar(30);
};

const preencher = async (inicio: string, fim: string, motivo = 'Motivo de teste') => {
  await digitar(dialogo().querySelector('[name="startDate"]')!, inicio);
  await digitar(dialogo().querySelector('[name="endDate"]')!, fim);
  await digitar(dialogo().querySelector('[name="observation"]')!, motivo);
};

const abrirModal = async () => {
  const host = await abrirPagina(Requests);
  await clicar(botaoPorTexto(host, /Nova Solicitação/));
  await esperar();
  return host;
};

const posts = () => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === '/ausencias');

test('Nova Solicitação: término antes do início é erro no campo e nada é enviado', async () => {
  await abrirModal();
  await preencher(emDias(20), emDias(15));
  await enviar();
  assert.match(dialogo().textContent ?? '', /A data de término não pode ser anterior à data de início\./);
  assert.equal(dialogo().querySelector('[name="endDate"]')!.getAttribute('aria-invalid'), 'true');
  assert.deepEqual(posts(), []);
});

test('Nova Solicitação: férias no passado ou com menos de 5 dias são recusadas antes do envio', async () => {
  await abrirModal();
  await preencher(emDias(-3), emDias(7));
  await enviar();
  assert.match(dialogo().textContent ?? '', /As férias precisam começar hoje ou depois\./);
  await preencher(emDias(10), emDias(12));
  await enviar();
  assert.match(dialogo().textContent ?? '', /mínimo 5 dias/);
  assert.deepEqual(posts(), []);
});

test('Nova Solicitação: o motivo em branco é recusado', async () => {
  await abrirModal();
  await preencher(emDias(10), emDias(14), '   ');
  await enviar();
  assert.match(dialogo().textContent ?? '', /Descreva o motivo da solicitação\./);
  assert.deepEqual(posts(), []);
});

test('Nova Solicitação: anexo acima de 5 MB ou fora de PDF, JPG e PNG é recusado no campo, e remover o limpa', async () => {
  await abrirModal();
  await preencher(emDias(10), emDias(14));

  await anexar(arquivoFalso('grande.pdf', 'application/pdf', new Uint8Array(5 * 1024 * 1024 + 1)));
  assert.match(dialogo().textContent ?? '', /O arquivo tem mais de 5 MB/);
  await enviar();
  assert.deepEqual(posts(), [], 'o anexo inválido bloqueia o envio');

  await anexar(arquivoFalso('animacao.gif', 'image/gif'));
  assert.match(dialogo().textContent ?? '', /Anexe um arquivo PDF, JPG ou PNG\./);

  await clicar(botaoPorTexto(dialogo(), /Remover anexo/));
  assert.doesNotMatch(dialogo().textContent ?? '', /Anexe um arquivo PDF, JPG ou PNG\.|O arquivo tem mais de 5 MB/);
  await enviar();
  assert.equal(posts().length, 1, 'sem anexo, férias seguem');
});

test('Nova Solicitação: a licença médica e o acidente de trabalho exigem anexo, a paternidade não', async () => {
  await abrirModal();
  await escolherTipo('Licença Médica');
  await preencher(emDias(-5), emDias(-3));
  await enviar();
  assert.match(dialogo().textContent ?? '', /Anexe o atestado médico\./);
  await escolherTipo('Acidente de Trabalho');
  await enviar();
  assert.match(dialogo().textContent ?? '', /Anexe o boletim de ocorrência/);
  assert.deepEqual(posts(), []);
  await escolherTipo('Licença Paternidade');
  await enviar();
  assert.equal(posts().length, 1);
});

test('Nova Solicitação: o pedido sai com o anexo em base64, o modal fecha, a lista recarrega e o RH é avisado por toast', async () => {
  let corpoEnviado = '';
  const original = globalThis.fetch;
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    if (new URL(String(entrada), 'http://localhost').pathname === '/api/ausencias' && init?.method === 'POST') corpoEnviado = String(init.body);
    return original(entrada, init);
  }) as typeof fetch;
  respostaDoPedido = () => json(solicitacao(30, { type: 'Licença Médica', hasAttachment: true, attachmentName: 'atestado.pdf' }), 201);

  const host = await abrirModal();
  await escolherTipo('Licença Médica');
  await preencher(emDias(-5), emDias(-3), '  Consulta com atestado.  ');
  await anexar(arquivoFalso('atestado.pdf', 'application/pdf', '%PDF-1.4 atestado'));
  await enviar();
  globalThis.fetch = original;

  assert.deepEqual(JSON.parse(corpoEnviado), {
    tipo: 'Licença Médica', inicio: emDias(-5), fim: emDias(-3), observacao: 'Consulta com atestado.',
    anexo: { nome: 'atestado.pdf', tipo: 'application/pdf', conteudo: Buffer.from('%PDF-1.4 atestado').toString('base64') },
  });
  assert.equal(porRole(document, 'dialog'), null, 'o modal fecha');
  assert.equal(document.querySelector('[role="status"]')?.textContent, 'Solicitação enviada ao RH.');
  assert.equal(chamadas.filter((c) => c.caminho === '/ausencias/minhas').length, 2, 'a lista volta do servidor');
  assert.equal(chamadas.filter((c) => c.caminho === '/ausencias/saldo/7').length, 2, 'o saldo também');
  assert.ok(host);
});

test('Minhas Solicitações: o colaborador vê Aprovada, o motivo da recusa e baixa o anexo', async () => {
  minhasSolicitacoes = [
    solicitacao(12, { type: 'Licença Médica', status: 'Aprovada', hasAttachment: true, attachmentName: 'atestado.pdf', decidedBy: 'Rita' }),
    solicitacao(13, { type: 'Férias', status: 'Recusada', reply: 'Pico de entregas.' }),
    solicitacao(14, { type: 'Outros', status: 'Pendente' }),
  ];
  const host = await abrirPagina(Requests);
  const linhas = [...host.querySelectorAll('tbody tr')].map((l) => l.textContent ?? '');
  assert.equal(linhas.length, 3);
  assert.match(linhas[0], /Licença Médica/);
  assert.match(linhas[0], /Aprovada/);
  assert.match(linhas[0], /10 dias/);
  assert.match(linhas[1], /Recusada/);
  assert.match(linhas[1], /Motivo: Pico de entregas\./);
  assert.match(linhas[2], /Pendente/);
  assert.match(linhas[2], /Sem anexo/);

  await clicar(botaoPorTexto(host, /atestado\.pdf/));
  await esperar(30);
  assert.ok(chamadas.some((c) => c.metodo === 'GET' && c.caminho === '/ausencias/12/anexo'));
  assert.deepEqual(salvos, [{ nome: 'atestado.pdf' }]);
});

test('Minhas Solicitações: o saldo e o período aquisitivo aparecem acima da lista, e o modal avisa o saldo ao pedir férias', async () => {
  const host = await abrirPagina(Requests);
  const saldo = host.querySelector('section[aria-label="Saldo de férias"]')!;
  assert.match(saldo.textContent ?? '', /60 dias\s*disponíveis/);
  assert.match(saldo.textContent ?? '', /15\/01\/2026 a 14\/01\/2027/);
  await clicar(botaoPorTexto(host, /Nova Solicitação/));
  await esperar();
  assert.match(dialogo().textContent ?? '', /Saldo de férias: 60 dias disponíveis\./);
  await escolherTipo('Outros');
  assert.doesNotMatch(dialogo().textContent ?? '', /Saldo de férias: 60/);
});

test('Minhas Solicitações: falha ao baixar o anexo vira toast de erro', async () => {
  minhasSolicitacoes = [solicitacao(15, { type: 'Licença Médica', status: 'Aprovada', hasAttachment: true, attachmentName: 'perdido.pdf' })];
  const host = await abrirPagina(Requests);
  await clicar(botaoPorTexto(host, /perdido\.pdf/));
  await esperar(30);
  assert.match(document.querySelector('[role="alert"]')?.textContent ?? '', /Anexo não encontrado\./);
  assert.deepEqual(salvos, []);
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
  const rotulo = `Adicionar nota em ${HOJE.split('-').reverse().join('/')}`;
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
  assert.ok(botaoPorTexto(host, /Justificativa de .*Atestado/), 'a linha agora oferece ver a justificativa');
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
    value: { getCurrentPosition: (_ok: unknown, erro: (e: { code: number }) => void) => erro({ code: 1 }) },
  });
  const host = await abrirPagina(EmployeeDashboard);
  await clicar(botaoPorTexto(host, /Registrar Entrada/));
  await esperar();
  assert.match(document.querySelector('[role="alert"]')!.textContent ?? '', /permita o acesso à sua localização/i);
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

  respostaDoRegistro = () => {
    registrosDeHoje = [{ id: 1, type: 'Entrada', time: '08:00', date: HOJE }];
    return json(registrosDeHoje[0], 201);
  };
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
