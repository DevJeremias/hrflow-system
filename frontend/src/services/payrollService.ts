import httpClient from './httpClient.ts';

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

const PAYROLL_PAGE_SIZE = 500;

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
  const payroll = [...firstPage];
  const totalPages = Math.ceil(total / PAYROLL_PAGE_SIZE);

  for (let pagina = 2; pagina <= totalPages; pagina += 1) {
    const page = await httpClient<EmployeePayroll[]>(`${API_URL}/processar?pagina=${pagina}&limite=${PAYROLL_PAGE_SIZE}`, {
      auth: true,
      errorMessage: 'Erro ao processar folha de pagamento'
    });
    payroll.push(...page);
  }

  if (payroll.length !== total) throw new Error('A folha recebida não corresponde ao total informado pela API');
  return payroll;
};

// Nova função para a visão do Colaborador
export const getMyPayroll = async (): Promise<EmployeePayroll[]> => {
  return await httpClient(`${API_URL}/meu-holerite`, { auth: true, errorMessage: 'Erro ao buscar meu holerite' });
};