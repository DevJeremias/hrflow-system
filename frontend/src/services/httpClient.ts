const API_BASE_URL = '/api';

// A sessão é um cookie HttpOnly que o navegador envia sozinho: o JavaScript nunca vê o token.
// O que ele vê é o cookie de CSRF (utils/sessao.js na API), que o servidor emite junto e que
// sai com a sessão. Ele é devolvido em X-CSRF-Token nas requisições que mudam estado e sua
// presença diz se há uma sessão a confirmar, sem chamar a API.
const CSRF_COOKIE = 'hrflow_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Respostas de proxy ou balanceador quando a API não responde.
const UNAVAILABLE_STATUSES = [502, 503, 504];

export const NETWORK_ERROR_MESSAGE = 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  for (const pair of document.cookie.split(';')) {
    const [key, ...value] = pair.trim().split('=');
    if (key === name) return value.join('=') || null;
  }
  return null;
};

const getCsrfToken = (): string | null => readCookie(CSRF_COOKIE);

// Há sessão para tentar confirmar em GET /api/auth/sessao.
export const hasSessionHint = (): boolean => getCsrfToken() !== null;

// Cada login e cada encerramento de sessão abre uma época nova. Uma resposta 401 de uma
// chamada feita em época anterior não pode derrubar a sessão atual (ver o tratamento do 401).
let sessionEpoch = 0;
export const startSessionEpoch = (): void => {
  sessionEpoch += 1;
};

// Esquece a sessão no navegador. O cookie HttpOnly só o servidor remove (POST /auth/logout, ou
// o 401 que ele devolve); aqui cai o cookie de CSRF, que o JavaScript consegue apagar.
export const forgetSession = (): void => {
  startSessionEpoch();
  if (typeof document !== 'undefined') {
    document.cookie = `${CSRF_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
};

// Quem guarda a sessão (AuthContext) se registra aqui: um 401 em qualquer chamada autenticada
// passa por este único ponto, em vez de cada tela decidir o que fazer.
let sessionExpiredHandler: (() => void) | null = null;
export const setSessionExpiredHandler = (handler: (() => void) | null): void => {
  sessionExpiredHandler = handler;
};

type ErrorMessage = string | ((data: any, status: number) => string);

export interface HttpRequestOptions extends RequestInit {
  auth?: boolean;
  errorMessage?: ErrorMessage;
  onResponse?: (response: Response) => void;
}

export class HttpError extends Error {
  readonly status: number;
  readonly data: any;

  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
  }

  // Sem resposta da API: rede fora, API parada ou proxy sem destino.
  get isNetworkError(): boolean {
    return this.status === 0 || UNAVAILABLE_STATUSES.includes(this.status);
  }
}

const parseResponse = async (response: Response): Promise<any> => {
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const httpClient = async <T = any>(path: string, options: HttpRequestOptions = {}): Promise<T> => {
  const { auth = false, errorMessage, onResponse, headers: optionHeaders, ...requestOptions } = options;
  const headers = new Headers(optionHeaders);

  if ((auth || requestOptions.body !== undefined) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const csrfToken = getCsrfToken();
  if (csrfToken && !SAFE_METHODS.includes((requestOptions.method ?? 'GET').toUpperCase())) {
    headers.set(CSRF_HEADER, csrfToken);
  }

  const epoch = sessionEpoch;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'same-origin',
      ...requestOptions,
      headers,
    });
  } catch (error) {
    // fetch só rejeita com TypeError quando não há resposta; um abort do chamador segue como está.
    if (error instanceof TypeError) throw new HttpError(NETWORK_ERROR_MESSAGE, 0, undefined);
    throw error;
  }
  const data = await parseResponse(response);

  if (!response.ok) {
    // Só encerra a sessão se ela ainda é a da época da chamada: uma resposta atrasada de um
    // login anterior não pode derrubar a sessão nova.
    if (response.status === 401 && auth && sessionEpoch === epoch) {
      sessionExpiredHandler?.();
    }

    if (UNAVAILABLE_STATUSES.includes(response.status)) {
      throw new HttpError(NETWORK_ERROR_MESSAGE, response.status, data);
    }

    const message = typeof errorMessage === 'function'
      ? errorMessage(data, response.status)
      : errorMessage || data?.mensagem || data?.erro || `Erro na requisição: ${response.status}`;
    throw new HttpError(message, response.status, data);
  }

  onResponse?.(response);
  return data as T;
};

export default httpClient;
