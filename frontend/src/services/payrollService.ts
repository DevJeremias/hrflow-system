import httpClient from './httpClient.ts';
import type { HoleriteApi } from '../types/api.ts';

export type EmployeePayroll = HoleriteApi;

const API_URL = '/folha';

// O maior limite que a API aceita por página: 2.000 colaboradores levam duas chamadas.
const PAYROLL_PAGE_SIZE = 1000;

export const generateMonthlyPayroll = async (): Promise<EmployeePayroll[]> => {
  let total = 0;
  const firstPage = await httpClient<EmployeePayroll[]>(`${API_URL}/processar?pagina=1&limite=${PAYROLL_PAGE_SIZE}`, {
    auth: true,
    errorMessage: 'Erro ao processar folha de pagamento',
    onResponse: (response) => {
      const header = response.headers.get('X-Total-Count');
      if (header === null || !/^\d+$/.test(header)) throw new Error('Resposta da API sem total válido da folha');
      total = Number(header);
    }
  });
  const totalPages = Math.ceil(total / PAYROLL_PAGE_SIZE);

  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) =>
      httpClient<EmployeePayroll[]>(`${API_URL}/processar?pagina=${i + 2}&limite=${PAYROLL_PAGE_SIZE}`, {
        auth: true,
        errorMessage: 'Erro ao processar folha de pagamento'
      })
    )
  );
  const payroll = [...firstPage, ...remaining.flat()];

  if (payroll.length !== total) throw new Error('A folha recebida não corresponde ao total informado pela API');
  return payroll;
};

// Nova função para a visão do Colaborador
export const getMyPayroll = async (): Promise<EmployeePayroll[]> => {
  return await httpClient<EmployeePayroll[]>(`${API_URL}/meu-holerite`, { auth: true, errorMessage: 'Erro ao buscar meu holerite' });
};