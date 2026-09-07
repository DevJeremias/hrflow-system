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
  const res = await fetch('http://localhost:3000/api/solicitacoes/minhas', { 
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    } 
  });
  if (!res.ok) throw new Error('Erro ao buscar minhas solicitações');
  return await res.json();
};

export const requestService = {
  getAllRequests: async (): Promise<EmployeeRequest[]> => [],
  createRequest: async (data: Omit<EmployeeRequest, 'id' | 'requestDate' | 'status'>) => {},
  getMyRequests,
  // Adicione qualquer outra função que a tela pedir aqui dentro
};

