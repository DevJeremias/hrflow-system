import httpClient from './httpClient';

export interface EmployeePayroll {
  id: string;
  name: string;
  role: string;
  department: string;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  totalGross: number;
  netSalary: number;
  employerCharges: number;
  earningsList: Array<{ description: string; value: number; isPercentage: boolean }>;
  deductionsList: Array<{ description: string; value: number; isPercentage: boolean }>;
}

const API_URL = '/folha';

export const generateMonthlyPayroll = async (): Promise<EmployeePayroll[]> => {
  return await httpClient(`${API_URL}/processar`, { auth: true, errorMessage: 'Erro ao processar folha de pagamento' });
};

// Nova função para a visão do Colaborador
export const getMyPayroll = async (): Promise<EmployeePayroll[]> => {
  return await httpClient(`${API_URL}/meu-holerite`, { auth: true, errorMessage: 'Erro ao buscar meu holerite' });
};