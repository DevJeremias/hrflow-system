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

const API_URL = 'http://localhost:3000/api/folha';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// Dispara o cálculo no Node.js e devolve os dados matemáticos prontos
export const generateMonthlyPayroll = async (): Promise<EmployeePayroll[]> => {
  const res = await fetch(`${API_URL}/processar`, { headers: getAuthHeaders() });
  
  if (!res.ok) {
    throw new Error('Erro ao processar folha de pagamento');
  }
  
  return await res.json();
};