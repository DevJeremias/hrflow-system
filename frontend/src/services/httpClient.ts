const API_BASE_URL = '/api';

type ErrorMessage = string | ((data: any, status: number) => string);

export interface HttpRequestOptions extends RequestInit {
  auth?: boolean;
  errorMessage?: ErrorMessage;
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
  const { auth = false, errorMessage, headers: optionHeaders, ...requestOptions } = options;
  const headers = new Headers(optionHeaders);

  if ((auth || requestOptions.body !== undefined) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    headers.set('Authorization', `Bearer ${localStorage.getItem('token')}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers,
  });
  const data = await parseResponse(response);

  if (!response.ok) {
    const message = typeof errorMessage === 'function'
      ? errorMessage(data, response.status)
      : errorMessage || data?.mensagem || data?.erro || `Erro na requisição: ${response.status}`;
    throw new HttpError(message, response.status, data);
  }

  return data as T;
};

export default httpClient;
