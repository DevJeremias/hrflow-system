import httpClient from './httpClient.ts';
import type { ConsultaDeAuditoriaApi, PeriodoContratualApi, RegistroDeAuditoriaApi } from '../types/api.ts';

export type RegistroDeAuditoria = RegistroDeAuditoriaApi;
export type PeriodoContratual = PeriodoContratualApi;

export interface AuditoriaQuery {
  pagina: number;
  limite: number;
  // `funcionario` com `funcionarioId` mostra tudo sobre aquele colaborador.
  entidade?: string;
  id?: number;
}

export interface PaginaDeAuditoria {
  registros: RegistroDeAuditoria[];
  total: number;
}

export const auditoriaService = {
  getPage: async ({ pagina, limite, entidade, id }: AuditoriaQuery): Promise<PaginaDeAuditoria> => {
    const consulta: ConsultaDeAuditoriaApi = { pagina, limite, ...(entidade ? { entidade } : {}), ...(id ? { id } : {}) };
    const params = new URLSearchParams(Object.entries(consulta).map(([chave, valor]) => [chave, String(valor)]));
    let total = 0;
    const registros = await httpClient<RegistroDeAuditoria[]>(`/auditoria?${params}`, {
      auth: true,
      errorMessage: (err) => err?.erro || 'Erro ao buscar a trilha de auditoria',
      onResponse: (response) => {
        const header = response.headers.get('X-Total-Count');
        if (header === null || !/^\d+$/.test(header)) throw new Error('Resposta da API sem total válido de registros');
        total = Number(header);
      },
    });
    return { registros, total };
  },

  getContractHistory: (funcionarioId: number): Promise<PeriodoContratual[]> =>
    httpClient<PeriodoContratual[]>(`/funcionarios/${funcionarioId}/historico-contratual`, {
      auth: true,
      errorMessage: (err) => err?.erro || 'Erro ao buscar o histórico contratual',
    }),
};
