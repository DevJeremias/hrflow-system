// Comportamento central do cliente HTTP (SEC-08): 401 encerra a sessão em um só lugar,
// falha de rede vira erro com mensagem, e a sessão em cookie HttpOnly nunca passa pelo JavaScript:
// o cliente só devolve o token CSRF nos métodos que mudam estado.
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import httpClient, {
  HttpError, NETWORK_ERROR_MESSAGE, REQUEST_TIMEOUT_MS, TIMEOUT_ERROR_MESSAGE, forgetSession, hasSessionHint, setSessionExpiredHandler, startSessionEpoch,
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

// O temporizador de AbortSignal.timeout não segura o processo vivo; este segura até o sinal abortar,
// senão o node:test acharia a promessa pendente órfã.
const segurarAte = (sinal?: AbortSignal | null) => {
  const vivo = setTimeout(() => {}, 5000);
  sinal?.addEventListener('abort', () => clearTimeout(vivo));
};

// fetch que só termina quando o sinal manda abortar, como uma API que não responde.
const semResposta = () => {
  globalThis.fetch = ((_url: string, init?: RequestInit) => new Promise((_, rejeitar) => {
    segurarAte(init?.signal);
    init?.signal?.addEventListener('abort', () => rejeitar(init.signal?.reason));
  })) as typeof fetch;
};

test('toda chamada leva um prazo de 30 s', async () => {
  const prazo = mock.method(AbortSignal, 'timeout');
  try {
    responder(200, { ok: true });
    await httpClient('/x');
    assert.equal(REQUEST_TIMEOUT_MS, 30000);
    assert.deepEqual(prazo.mock.calls.map((chamada) => chamada.arguments[0]), [30000]);
    assert.ok(opcoes?.signal instanceof AbortSignal);
  } finally {
    prazo.mock.restore();
  }
});

test('requisição sem resposta no prazo vira erro de conexão com a mensagem de nova tentativa', async () => {
  semResposta();
  await assert.rejects(httpClient('/x', { auth: true, timeoutMs: 20 }), (erro: unknown) =>
    erro instanceof HttpError && erro.isNetworkError && erro.status === 0 && erro.message === TIMEOUT_ERROR_MESSAGE);
  assert.equal(encerramentos, 0);
});

test('o prazo cobre também o corpo da resposta que para no meio', async () => {
  globalThis.fetch = ((_url: string, init?: RequestInit) => Promise.resolve(new Response(new ReadableStream({
    start(controle) {
      segurarAte(init?.signal);
      init?.signal?.addEventListener('abort', () => controle.error(init.signal?.reason));
    },
  })))) as typeof fetch;
  await assert.rejects(httpClient('/x', { timeoutMs: 20 }), (erro: unknown) =>
    erro instanceof HttpError && erro.message === TIMEOUT_ERROR_MESSAGE);
});

test('o abort do chamador continua valendo junto com o prazo e não vira erro de prazo', async () => {
  semResposta();
  const chamador = new AbortController();
  const chamada = httpClient('/x', { signal: chamador.signal });
  chamador.abort();
  await assert.rejects(chamada, (erro: unknown) => !(erro instanceof HttpError));
});

test('uma resposta de erro do servidor não é erro de rede', async () => {
  responder(500, { erro: 'falha' });
  await assert.rejects(httpClient('/x'), (erro: unknown) => erro instanceof HttpError && !erro.isNetworkError);
});

test('responseType blob entrega o arquivo da resposta bem-sucedida e mantém o erro em JSON', async () => {
  globalThis.fetch = (async () => new Response('%PDF-1.3 ficticio', { status: 200, headers: { 'Content-Type': 'application/pdf' } })) as typeof fetch;
  const arquivo = await httpClient<Blob>('/folha/competencias/2026-10/holerites.pdf', { auth: true, responseType: 'blob' });
  assert.equal(arquivo instanceof Blob, true);
  assert.equal(await arquivo.text(), '%PDF-1.3 ficticio');

  responder(404, { erro: 'A folha de 10/2026 ainda não foi processada.' });
  await assert.rejects(
    httpClient<Blob>('/folha/competencias/2026-10/holerites.pdf', { auth: true, responseType: 'blob' }),
    (erro: unknown) => erro instanceof HttpError && erro.status === 404 && erro.message === 'A folha de 10/2026 ainda não foi processada.',
  );
});
