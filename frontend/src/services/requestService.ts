import httpClient from './httpClient';

// src/services/requestService.ts

export type RequestType = 
  | 'Férias' 
  | 'Licença Médica' 
  | 'Licença Maternidade' 
  | 'Licença Paternidade' 
  | 'Acidente de Trabalho' 
  | 'Outros';

export type RequestStatus = 'Pendente' | 'Aprovada' | 'Recusada';

export interface EmployeeRequest {
  id: string | number;
  type: RequestType;
  requestDate: string;
  startDate: string;
  endDate: string;
  observation: string;
  hasAttachment: boolean;
  status: RequestStatus;
}

const getMyRequests = async (): Promise<EmployeeRequest[]> => {
  // Confirme se a URL abaixo bate com a rota de solicitações do seu backend
  return await httpClient('/solicitacoes/minhas', { auth: true, errorMessage: 'Erro ao buscar minhas solicitações' });
};

export const requestService = {
  getAllRequests: async (): Promise<EmployeeRequest[]> => [],
  createRequest: async (data: Omit<EmployeeRequest, 'id' | 'requestDate' | 'status'>) => {},
  getMyRequests,
  // Adicione qualquer outra função que a tela pedir aqui dentro
};

