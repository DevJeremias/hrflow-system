// src/services/payrollService.ts

export interface CalculatedItem {
  description: string;
  value: number;
  isPercentage: boolean;
}

export interface EmployeePayroll {
  id: string;
  name: string;
  role: string;
  department: string;
  baseSalary: number;
  earningsList: CalculatedItem[];
  deductionsList: CalculatedItem[];
  totalEarnings: number;
  totalGross: number;
  totalDeductions: number;
  netSalary: number;
  employerCharges: number; // Novo: Encargos Patronais
}

// Simulando banco de dados com Lançamentos Avulsos (customEarnings)
const mockActiveEmployees = [
  {
    id: '1', name: 'Carlos Santos', role: 'Engenheiro de Software', department: 'Tecnologia', baseSalary: 12500,
    cargoEarnings: [{ description: 'Auxílio Home Office', valueType: 'fixed', value: '500' }],
    cargoDeductions: [{ description: 'Plano de Saúde', valueType: 'fixed', value: '150' }, { description: 'INSS', valueType: 'percentage', value: '14' }],
    customEarnings: [{ description: 'Bônus de Projeto', valueType: 'fixed', value: '1000' }] // Lançamento Avulso!
  },
  {
    id: '2', name: 'Ana Costa', role: 'Analista de Recrutamento', department: 'Recursos Humanos', baseSalary: 5800,
    cargoEarnings: [{ description: 'Vale Refeição', valueType: 'fixed', value: '800' }, { description: 'Bônus Meta', valueType: 'percentage', value: '5' }],
    cargoDeductions: [{ description: 'INSS', valueType: 'percentage', value: '11' }],
    customDeductions: [{ description: 'Adiantamento', valueType: 'fixed', value: '300' }] // Desconto Avulso!
  },
  {
    id: '3', name: 'Roberto Almeida', role: 'Coordenador de TI', department: 'Tecnologia', baseSalary: 18000,
    cargoEarnings: [{ description: 'Adicional de Chefia', valueType: 'percentage', value: '10' }],
    cargoDeductions: [{ description: 'IRRF', valueType: 'percentage', value: '27.5' }, { description: 'Previdência Privada', valueType: 'fixed', value: '1000' }]
  }
];

const calculateItems = (baseSalary: number, items: any[]): { list: CalculatedItem[], total: number } => {
  if (!items || items.length === 0) return { list: [], total: 0 };
  let total = 0;
  
  const list = items.map(item => {
    const numericValue = parseFloat(item.value || '0');
    const finalValue = item.valueType === 'percentage' ? (baseSalary * numericValue) / 100 : numericValue;
    total += finalValue;
    return { description: item.description, value: finalValue, isPercentage: item.valueType === 'percentage' };
  });

  return { list, total };
};

// Agora retorna apenas o Array de Funcionários (O Dashboard cuida do resto dinamicamente)
export const generateMonthlyPayroll = async (): Promise<EmployeePayroll[]> => {
  await new Promise(resolve => setTimeout(resolve, 800)); // Delay da API

  return mockActiveEmployees.map(emp => {
    // Junta as regras do Cargo com os Lançamentos Avulsos do Mês
    const allEarnings = [...(emp.cargoEarnings || []), ...(emp.customEarnings || [])];
    const allDeductions = [...(emp.cargoDeductions || []), ...(emp.customDeductions || [])];

    const earningsMath = calculateItems(emp.baseSalary, allEarnings);
    const deductionsMath = calculateItems(emp.baseSalary, allDeductions);

    const totalGross = emp.baseSalary + earningsMath.total;
    const totalDeductions = deductionsMath.total;
    
    return {
      id: emp.id,
      name: emp.name,
      role: emp.role,
      department: emp.department,
      baseSalary: emp.baseSalary,
      earningsList: earningsMath.list,
      deductionsList: deductionsMath.list,
      totalEarnings: earningsMath.total,
      totalGross: totalGross,
      totalDeductions: totalDeductions,
      netSalary: totalGross - totalDeductions,
      employerCharges: totalGross * 0.278 // Cálculo base de encargos empresa (FGTS + INSS Patronal)
    };
  });
};