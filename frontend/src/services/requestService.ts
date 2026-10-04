import httpClient from './httpClient';
import type { CorpoDeAusenciaApi, CorpoDeDecisaoDaAusenciaApi, SaldoDeFeriasApi, SolicitacaoApi, StatusDeSolicitacaoApi, TipoDeSolicitacaoApi } from '../types/api';
import { lerComoBase64, tipoDoArquivo } from '../utils/solicitacoes';

// src/services/requestService.ts

const API_URL = '/ausencias';

export type RequestType = TipoDeSolicitacaoApi;
export type RequestStatus = StatusDeSolicitacaoApi;
export type EmployeeRequest = SolicitacaoApi;
export type RequestDecision = CorpoDeDecisaoDaAusenciaApi;
export type VacationBalance = SaldoDeFeriasApi;

export interface NewRequest {
  type: RequestType;
  startDate: string;
  endDate: string;
  observation: string;
  attachment: File | null;
}

export interface CompanyRequestQuery {
  pagina: number;
  limite: number;
  status?: RequestStatus;
}

export interface CompanyRequestPage {
  requests: EmployeeRequest[];
  total: number;
}

const getMyRequests = async (): Promise<EmployeeRequest[]> => {
  const data = await httpClient<EmployeeRequest[]>(`${API_URL}/minhas`, { auth: true, errorMessage: 'Erro ao buscar minhas solicitações' });
  if (!Array.isArray(data)) throw new Error('Resposta inválida ao buscar minhas solicitações');
  return data;
};

const getAllRequests = async ({ pagina, limite, status }: CompanyRequestQuery): Promise<CompanyRequestPage> => {
  const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite), ...(status ? { status } : {}) });
  let total = 0;
  const requests = await httpClient<EmployeeRequest[]>(`${API_URL}?${params}`, {
    auth: true,
    errorMessage: 'Erro ao buscar as solicitações',
    onResponse: (response) => {
      const header = response.headers.get('X-Total-Count');
      if (header === null || !/^\d+$/.test(header)) throw new Error('Resposta da API sem total válido de solicitações');
      total = Number(header);
    },
  });
  if (!Array.isArray(requests)) throw new Error('Resposta inválida ao buscar as solicitações');
  return { requests, total };
};

// Devolve a solicitação criada. O anexo vai no corpo em base64; o tipo é o que a API confere nos primeiros bytes.
const createRequest = async ({ type, startDate, endDate, observation, attachment }: NewRequest): Promise<EmployeeRequest> => {
  const body: CorpoDeAusenciaApi = {
    tipo: type,
    inicio: startDate,
    fim: endDate,
    observacao: observation.trim(),
    ...(attachment ? { anexo: { nome: attachment.name, tipo: tipoDoArquivo(attachment), conteudo: await lerComoBase64(attachment) } } : {}),
  };
  return httpClient<EmployeeRequest>(API_URL, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(body),
    errorMessage: (err) => err?.erro || 'Erro ao enviar a solicitação',
  });
};

const decideRequest = async (id: number, decision: RequestDecision): Promise<EmployeeRequest> =>
  httpClient<EmployeeRequest>(`${API_URL}/${id}/decisao`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(decision),
    errorMessage: (err) => err?.erro || 'Erro ao registrar a decisão',
  });

const getBalance = async (employeeId: number): Promise<VacationBalance> =>
  httpClient<VacationBalance>(`${API_URL}/saldo/${employeeId}`, { auth: true, errorMessage: (err) => err?.erro || 'Erro ao calcular o saldo de férias' });

const getAttachment = async (id: number): Promise<Blob> =>
  httpClient<Blob>(`${API_URL}/${id}/anexo`, { auth: true, responseType: 'blob', errorMessage: (err) => err?.erro || 'Erro ao baixar o anexo' });

export const requestService = {
  getMyRequests,
  getAllRequests,
  createRequest,
  decideRequest,
  getBalance,
  getAttachment,
};
