import httpClient, { HttpError } from './httpClient.ts';
import { baixarArquivo, nomeSugerido } from '../utils/arquivo.ts';

export interface PayrollLine {
  description: string;
  value: number;
  isPercentage: boolean;
  // O texto da coluna de referência do holerite (dias, horas, alíquota); nulo quando não há.
  reference: string | null;
}

// O que o RH lança por colaborador e mês, em reais. O vale-transporte é o custo do vale: o desconto
// é o menor entre ele e 6% do salário.
export interface PayrollEntries {
  adiantamento: number;
  valeTransporte: number;
  valeRefeicao: number;
  planoSaude: number;
}

// As bases de cálculo do holerite; nulas nos holerites emitidos antes do IRRF.
export interface PayrollBases {
  inss: number;
  fgts: number;
  irrf: number;
}

export interface EmployeePayroll {
  id: string;
  name: string;
  role: string;
  department: string;
  contract: string | null;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  totalGross: number;
  netSalary: number;
  // FGTS e contribuições patronais: custo da empresa, que não sai do líquido.
  employerCharges: number;
  inss: number;
  irrf: number;
  fgts: number;
  dependents: number;
  bases: PayrollBases | null;
  lancamentos: PayrollEntries;
  earningsList: PayrollLine[];
  deductionsList: PayrollLine[];
  chargesList: PayrollLine[];
}

// Razão social e CNPJ (só dígitos) que a folha copiou da empresa; nulos até alguém preenchê-los.
export interface PayrollCompany {
  razaoSocial: string | null;
  cnpj: string | null;
}

export interface PayrollPending {
  funcionarioId: number;
  nome: string;
  motivo: string;
}

export type PayrollStatus = 'aberta' | 'fechada';

export type TaxRegime = 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real';

export interface MonthlyPayroll {
  competencia: string;
  status: PayrollStatus;
  processadaEm: string;
  fechadaEm: string | null;
  empresa: PayrollCompany;
  // O regime que valeu nos encargos; nulo quando a empresa não o informou (vale a regra geral).
  regimeTributario: TaxRegime | null;
  totais: { bruto: number; descontos: number; liquido: number; encargos: number; inss: number; irrf: number; fgts: number };
  itens: EmployeePayroll[];
  pendencias: PayrollPending[];
}

// O holerite que o colaborador vê: o de uma folha fechada, com a competência e a empresa dela.
export interface Payslip extends EmployeePayroll {
  competencia: string;
  empresa: PayrollCompany;
}

const API_URL = '/folha';

// A mensagem da API (competência futura, folha fechada, empresa sem CNPJ) já diz o que fazer.
const apiMessage = (fallback: string) => (data: { erro?: string } | undefined) => data?.erro || fallback;

const competenciaUrl = (competencia: string) => `${API_URL}/competencias/${competencia}`;

// A folha da competência, ou null se ainda não foi processada (a API responde 404).
export const getPayroll = async (competencia: string): Promise<MonthlyPayroll | null> => {
  try {
    return await httpClient<MonthlyPayroll>(competenciaUrl(competencia), { auth: true, errorMessage: apiMessage('Erro ao buscar a folha de pagamento') });
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
};

// Cria a folha da competência ou, estando ela aberta, recalcula com o cadastro de agora.
export const processPayroll = (competencia: string): Promise<MonthlyPayroll> =>
  httpClient<MonthlyPayroll>(`${competenciaUrl(competencia)}/processar`, { method: 'POST', auth: true, errorMessage: apiMessage('Erro ao processar folha de pagamento') });

export const closePayroll = (competencia: string): Promise<MonthlyPayroll> =>
  httpClient<MonthlyPayroll>(`${competenciaUrl(competencia)}/fechar`, { method: 'POST', auth: true, errorMessage: apiMessage('Erro ao fechar a folha de pagamento') });

// Visão do Colaborador: os holerites das folhas fechadas, do mês mais recente ao mais antigo.
export const getMyPayslips = (): Promise<Payslip[]> =>
  httpClient<Payslip[]>(`${API_URL}/meus-holerites`, { auth: true, errorMessage: 'Erro ao buscar meus holerites' });

// Substitui os lançamentos de um colaborador na folha aberta; a API recalcula só o holerite dele e o devolve.
export const savePayrollEntries = (competencia: string, funcionarioId: string, lancamentos: PayrollEntries): Promise<EmployeePayroll> =>
  httpClient<EmployeePayroll>(`${competenciaUrl(competencia)}/lancamentos/${funcionarioId}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(lancamentos),
    errorMessage: apiMessage('Não foi possível salvar os lançamentos.'),
  });

// Baixa o PDF: o servidor o gera, e o arquivo vem por uma chamada autenticada.
const downloadPdf = async (path: string, fallbackName: string): Promise<void> => {
  let response: Response | null = null;
  const arquivo = await httpClient<Blob>(path, {
    auth: true,
    responseType: 'blob',
    errorMessage: apiMessage('Não foi possível gerar o PDF.'),
    onResponse: (res) => { response = res; },
  });
  baixarArquivo(arquivo, nomeSugerido(response, fallbackName));
};

// Os holerites de todos os colaboradores da folha, uma página cada.
export const downloadPayrollPdf = (competencia: string): Promise<void> =>
  downloadPdf(`${competenciaUrl(competencia)}/holerites.pdf`, `holerites-${competencia}.pdf`);

export const downloadPayslipPdf = (competencia: string, funcionarioId: string): Promise<void> =>
  downloadPdf(`${competenciaUrl(competencia)}/holerites/${funcionarioId}.pdf`, `holerite-${competencia}.pdf`);

// Visão do Colaborador: o próprio holerite de uma folha fechada.
export const downloadMyPayslipPdf = (competencia: string): Promise<void> =>
  downloadPdf(`${API_URL}/meu-holerite.pdf?competencia=${competencia}`, `holerite-${competencia}.pdf`);
