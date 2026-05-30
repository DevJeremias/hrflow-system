// src/services/requestService.ts

export type RequestType = 'Férias' | 'Licença Médica' | 'Licença Maternidade' | 'Licença Paternidade' | 'Acidente de Trabalho' | 'Outros';
export type RequestStatus = 'Pendente' | 'Aprovada' | 'Recusada';

export interface EmployeeRequest {
  id: string;
  type: RequestType;
  startDate: string;
  endDate: string;
  requestDate: string;
  status: RequestStatus;
  observation: string;
  hasAttachment: boolean;
}

export const requestService = {
  // Busca o histórico de solicitações do usuário logado
  getMyRequests: async (): Promise<EmployeeRequest[]> => {
    await new Promise(resolve => setTimeout(resolve, 800)); // Latência simulada
    
    // Mock inicial
    const mockDb = JSON.parse(localStorage.getItem('@RHPRO:my_requests') || 'null');
    if (!mockDb) {
      const initialMock: EmployeeRequest[] = [
        { id: '1', type: 'Licença Médica', startDate: '2026-03-10', endDate: '2026-03-12', requestDate: '2026-03-09', status: 'Aprovada', observation: 'Virose forte. Atestado em anexo.', hasAttachment: true },
        { id: '2', type: 'Férias', startDate: '2026-12-15', endDate: '2026-12-30', requestDate: '2026-05-10', status: 'Pendente', observation: 'Férias de fim de ano com a família.', hasAttachment: false },
      ];
      localStorage.setItem('@RHPRO:my_requests', JSON.stringify(initialMock));
      return initialMock;
    }
    return mockDb;
  },

  // Envia uma nova solicitação
  createRequest: async (data: Omit<EmployeeRequest, 'id' | 'requestDate' | 'status'>): Promise<EmployeeRequest> => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newRequest: EmployeeRequest = {
      ...data,
      id: Math.random().toString(36).substring(2, 9),
      requestDate: new Date().toISOString().split('T')[0],
      status: 'Pendente' // Toda nova solicitação nasce como pendente
    };

    const currentRequests = JSON.parse(localStorage.getItem('@RHPRO:my_requests') || '[]');
    localStorage.setItem('@RHPRO:my_requests', JSON.stringify([newRequest, ...currentRequests]));

    return newRequest;
  }
};