const API_BASE_URL = '/api';
const TOKEN_KEY = 'token';

// Respostas de proxy ou balanceador quando a API não responde.
const UNAVAILABLE_STATUSES = [502, 503, 504];

export const NETWORK_ERROR_MESSAGE = 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';

export const getAuthToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setAuthToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearAuthToken = (): void => localStorage.removeItem(TOKEN_KEY);

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

  const token = auth ? getAuthToken() : null;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
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
    // Só encerra a sessão se o token ainda é o que foi enviado: uma resposta atrasada de um
    // login anterior não pode derrubar a sessão nova.
    if (response.status === 401 && auth && getAuthToken() === token) {
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
