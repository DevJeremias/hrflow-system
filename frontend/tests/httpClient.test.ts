// Comportamento central do cliente HTTP (SEC-08): 401 encerra a sessão em um só lugar,
// falha de rede vira erro com mensagem, e nunca se envia "Bearer null".
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import httpClient, {
  HttpError, NETWORK_ERROR_MESSAGE, getAuthToken, setAuthToken, clearAuthToken, setSessionExpiredHandler,
} from '../src/services/httpClient.ts';

const memoria = new Map<string, string>();
const fetchOriginal = globalThis.fetch;
let encerramentos = 0;
let cabecalhos: Headers | undefined;

const responder = (status: number, corpo: unknown) => {
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    cabecalhos = init?.headers as Headers;
    return new Response(JSON.stringify(corpo), { status });
  }) as typeof fetch;
};

beforeEach(() => {
  memoria.clear();
  encerramentos = 0;
  cabecalhos = undefined;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (chave: string) => memoria.get(chave) ?? null,
      setItem: (chave: string, valor: string) => { memoria.set(chave, valor); },
      removeItem: (chave: string) => { memoria.delete(chave); },
    },
  });
  setSessionExpiredHandler(() => { encerramentos += 1; });
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  setSessionExpiredHandler(null);
});

test('envia o token guardado e nada quando não há token', async () => {
  responder(200, { ok: true });
  setAuthToken('token-ficticio');
  await httpClient('/x', { auth: true });
  assert.equal(cabecalhos?.get('Authorization'), 'Bearer token-ficticio');

  clearAuthToken();
  await httpClient('/x', { auth: true });
  assert.equal(cabecalhos?.has('Authorization'), false, 'sem token não pode ir "Bearer null"');
});

test('401 em chamada autenticada aciona o encerramento central da sessão e ainda lança o erro', async () => {
  responder(401, { erro: 'Token inválido ou expirado.' });
  setAuthToken('token-ficticio');
  await assert.rejects(httpClient('/x', { auth: true }), (erro: unknown) => erro instanceof HttpError && erro.status === 401);
  assert.equal(encerramentos, 1);
});

test('401 de uma chamada pública (login com senha errada) não encerra sessão', async () => {
  responder(401, { erro: 'E-mail ou senha inválidos.' });
  await assert.rejects(httpClient('/auth/login', { method: 'POST', body: '{}' }), HttpError);
  assert.equal(encerramentos, 0);
});

test('resposta 401 atrasada de um token antigo não derruba a sessão nova', async () => {
  setAuthToken('token-antigo');
  globalThis.fetch = (async () => {
    setAuthToken('token-novo'); // novo login enquanto a chamada antiga estava em voo
    return new Response('{}', { status: 401 });
  }) as typeof fetch;
  await assert.rejects(httpClient('/x', { auth: true }), HttpError);
  assert.equal(encerramentos, 0);
  assert.equal(getAuthToken(), 'token-novo');
});

test('outros erros HTTP não encerram a sessão', async () => {
  setAuthToken('token-ficticio');
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
