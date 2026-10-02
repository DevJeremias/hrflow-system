// Comportamento central do cliente HTTP (SEC-08): 401 encerra a sessão em um só lugar,
// falha de rede vira erro com mensagem, e a sessão em cookie HttpOnly nunca passa pelo JavaScript:
// o cliente só devolve o token CSRF nos métodos que mudam estado.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import httpClient, {
  HttpError, NETWORK_ERROR_MESSAGE, forgetSession, hasSessionHint, setSessionExpiredHandler, startSessionEpoch,
} from '../src/services/httpClient.ts';

// Jar mínimo no lugar de document.cookie: guarda os pares e entende a expiração por Max-Age=0.
const jar = new Map<string, string>();
const fetchOriginal = globalThis.fetch;
let encerramentos = 0;
let cabecalhos: Headers | undefined;
let opcoes: RequestInit | undefined;

const responder = (status: number, corpo: unknown) => {
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    cabecalhos = init?.headers as Headers;
    opcoes = init;
    return new Response(JSON.stringify(corpo), { status });
  }) as typeof fetch;
};

beforeEach(() => {
  jar.clear();
  encerramentos = 0;
  cabecalhos = undefined;
  opcoes = undefined;
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      get cookie() {
        return [...jar].map(([chave, valor]) => `${chave}=${valor}`).join('; ');
      },
      set cookie(linha: string) {
        const [par, ...atributos] = linha.split(';').map((parte) => parte.trim());
        const [chave, ...valor] = par.split('=');
        if (atributos.includes('Max-Age=0')) jar.delete(chave);
        else jar.set(chave, valor.join('='));
      },
    },
  });
  setSessionExpiredHandler(() => { encerramentos += 1; });
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  setSessionExpiredHandler(null);
  Reflect.deleteProperty(globalThis, 'document');
});

const entrar = (csrf = 'csrf-ficticio') => { jar.set('hrflow_csrf', csrf); startSessionEpoch(); };

test('nunca envia Authorization: o token da sessão não existe para o JavaScript', async () => {
  responder(200, { ok: true });
  entrar();
  await httpClient('/x', { auth: true });
  assert.equal(cabecalhos?.has('Authorization'), false);
  assert.equal(opcoes?.credentials, 'same-origin');
});

test('devolve o token CSRF nos métodos que mudam estado e não nos de leitura', async () => {
  responder(200, { ok: true });
  entrar('csrf-da-sessao');

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
    await httpClient('/x', { auth: true, method });
    assert.equal(cabecalhos?.get('X-CSRF-Token'), 'csrf-da-sessao', method);
  }
  for (const method of [undefined, 'GET', 'HEAD']) {
    await httpClient('/x', { auth: true, method });
    assert.equal(cabecalhos?.has('X-CSRF-Token'), false, String(method));
  }
});

test('sem sessão não há cabeçalho CSRF, nem "undefined" ou vazio', async () => {
  responder(200, { ok: true });
  await httpClient('/x', { method: 'POST', body: '{}' });
  assert.equal(cabecalhos?.has('X-CSRF-Token'), false);
});

test('hasSessionHint acompanha o cookie de CSRF e forgetSession o apaga', () => {
  assert.equal(hasSessionHint(), false);
  entrar();
  assert.equal(hasSessionHint(), true);
  forgetSession();
  assert.equal(hasSessionHint(), false);
});

test('hasSessionHint ignora cookies de outros nomes, mesmo com valor parecido', () => {
  jar.set('hrflow_csrf_falso', 'x');
  jar.set('outro', 'hrflow_csrf=x');
  assert.equal(hasSessionHint(), false);
});

test('fora do navegador (sem document) não há sessão a confirmar', async () => {
  Reflect.deleteProperty(globalThis, 'document');
  assert.equal(hasSessionHint(), false);
  responder(200, { ok: true });
  await httpClient('/x', { auth: true, method: 'POST' });
  assert.equal(cabecalhos?.has('X-CSRF-Token'), false);
});

test('401 em chamada autenticada aciona o encerramento central da sessão e ainda lança o erro', async () => {
  responder(401, { erro: 'Token inválido ou expirado.' });
  entrar();
  await assert.rejects(httpClient('/x', { auth: true }), (erro: unknown) => erro instanceof HttpError && erro.status === 401);
  assert.equal(encerramentos, 1);
});

test('401 de uma chamada pública (login com senha errada) não encerra sessão', async () => {
  responder(401, { erro: 'E-mail ou senha inválidos.' });
  await assert.rejects(httpClient('/auth/login', { method: 'POST', body: '{}' }), HttpError);
  assert.equal(encerramentos, 0);
});

test('resposta 401 atrasada de uma sessão antiga não derruba a sessão nova', async () => {
  entrar('csrf-antigo');
  globalThis.fetch = (async () => {
    entrar('csrf-novo'); // novo login enquanto a chamada antiga estava em voo
    return new Response('{}', { status: 401 });
  }) as typeof fetch;
  await assert.rejects(httpClient('/x', { auth: true }), HttpError);
  assert.equal(encerramentos, 0);
  assert.equal(hasSessionHint(), true);
});

test('resposta 401 atrasada depois de um logout também não reabre aviso de sessão expirada', async () => {
  entrar();
  globalThis.fetch = (async () => {
    forgetSession(); // o usuário saiu enquanto a chamada estava em voo
    return new Response('{}', { status: 401 });
  }) as typeof fetch;
  await assert.rejects(httpClient('/x', { auth: true }), HttpError);
  assert.equal(encerramentos, 0);
});

test('outros erros HTTP não encerram a sessão', async () => {
  entrar();
  for (const status of [400, 403, 404, 500]) {
    responder(status, { erro: 'falha' });
    await assert.rejects(httpClient('/x', { auth: true }), (erro: unknown) => erro instanceof HttpError && erro.status === status);
  }
  assert.equal(encerramentos, 0);
});

test('falha de rede vira HttpError com mensagem em pt-BR, marcado como erro de rede', async () => {
  globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch;
  await assert.rejects(httpClient('/x', { auth: true }), (erro: unknown) =>
    erro instanceof HttpError && erro.isNetworkError && erro.message === NETWORK_ERROR_MESSAGE);
  assert.equal(encerramentos, 0);
});

test('502, 503 e 504 (proxy sem API) também são erro de conexão, mesmo com mensagem própria da tela', async () => {
  for (const status of [502, 503, 504]) {
    responder(status, undefined);
    await assert.rejects(httpClient('/x', { errorMessage: 'Erro ao buscar colaboradores' }), (erro: unknown) =>
      erro instanceof HttpError && erro.isNetworkError && erro.message === NETWORK_ERROR_MESSAGE);
  }
});

test('abort pedido pelo chamador não é tratado como falha de rede', async () => {
  globalThis.fetch = (async () => { throw new DOMException('aborted', 'AbortError'); }) as typeof fetch;
  await assert.rejects(httpClient('/x'), (erro: unknown) => !(erro instanceof HttpError));
});

test('uma resposta de erro do servidor não é erro de rede', async () => {
  responder(500, { erro: 'falha' });
  await assert.rejects(httpClient('/x'), (erro: unknown) => erro instanceof HttpError && !erro.isNetworkError);
});
