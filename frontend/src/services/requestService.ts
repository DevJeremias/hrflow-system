import httpClient from './httpClient';
import type { SolicitacaoApi, StatusDeSolicitacaoApi, TipoDeSolicitacaoApi } from '../types/api';

// src/services/requestService.ts

export type RequestType = TipoDeSolicitacaoApi;
export type RequestStatus = StatusDeSolicitacaoApi;
export type EmployeeRequest = SolicitacaoApi;

const naoImplementado = (): never => {
  throw new Error('Solicitações ainda não estão disponíveis: a API correspondente não foi implementada.');
};

const getMyRequests = async (): Promise<EmployeeRequest[]> => {
  // Confirme se a URL abaixo bate com a rota de solicitações do seu backend
  return await httpClient<EmployeeRequest[]>('/solicitacoes/minhas', { auth: true, errorMessage: 'Erro ao buscar minhas solicitações' });
};

export const requestService = {
  getAllRequests: async (): Promise<EmployeeRequest[]> => naoImplementado(),
  createRequest: async (_data: Omit<EmployeeRequest, 'id' | 'requestDate' | 'status'>): Promise<void> => naoImplementado(),
  getMyRequests,
};

