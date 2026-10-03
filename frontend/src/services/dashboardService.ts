import httpClient from './httpClient.ts';
import type { ResumoDoDashboardApi } from '../types/api.ts';

export interface DashboardSummary {
  activeEmployees: number;
  inactiveEmployees: number;
  departments: number;
  roles: number;
  punchesToday: number;
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

export const dashboardService = {
  getSummary: async (): Promise<DashboardSummary> => {
    const data = await httpClient<ResumoDoDashboardApi>('/dashboard/resumo', {
      auth: true,
      errorMessage: 'Erro ao carregar o resumo do dashboard',
    });
    if (!data || ![data.colaboradoresAtivos, data.colaboradoresInativos, data.departamentos, data.cargos, data.marcacoesHoje].every(isCount)) {
      throw new Error('Resposta inválida ao carregar o resumo do dashboard');
    }
    return {
      activeEmployees: data.colaboradoresAtivos,
      inactiveEmployees: data.colaboradoresInativos,
      departments: data.departamentos,
      roles: data.cargos,
      punchesToday: data.marcacoesHoje,
    };
  },
};
