import httpClient from './httpClient';
import type {
  CorpoDeRegistroApi, DecisaoDeJustificativaApi, DiaDoHistoricoApi, JornadaApi, JustificativaApi, PontoDaEmpresaApi,
  RegistroDePontoApi, StatusDaJustificativaApi, StatusDoDiaApi, TotaisDePontoApi, TotaisDoPeriodoApi, TotalSemanalApi,
} from '../types/api';

// src/services/pontoService.ts

export type PointRecord = RegistroDePontoApi;
export type DayStatus = StatusDoDiaApi;
export type JustificationStatus = StatusDaJustificativaApi;
export type HistoryDay = DiaDoHistoricoApi;
export type CompanyPointRecord = PontoDaEmpresaApi;

export interface CompanyPointQuery {
  mes: string;
  pagina: number;
  limite: number;
  busca?: string;
}

export interface CompanyPointPage {
  registros: CompanyPointRecord[];
  total: number;
}

export type PeriodTotals = TotaisDoPeriodoApi;
export type WeeklyTotal = TotalSemanalApi;
export type WorkSchedule = JornadaApi;
export type MonthTotals = TotaisDePontoApi;
export type Justification = JustificativaApi;
export type JustificationDecision = DecisaoDeJustificativaApi;

// A rota correta (no singular) do seu Back-end
const API_URL = '/ponto'; 

export const pontoService = {
  // Uma página das marcações do mês 'AAAA-MM'; `total` é o de todo o mês (X-Total-Count).
  getRegistrosDaEmpresa: async ({ mes, pagina, limite, busca }: CompanyPointQuery): Promise<CompanyPointPage> => {
    const params = new URLSearchParams({ mes, pagina: String(pagina), limite: String(limite) });
    if (busca) params.set('busca', busca);
    let total = 0;
    const data = await httpClient<CompanyPointRecord[]>(`${API_URL}?${params}`, {
      auth: true,
      errorMessage: 'Erro ao buscar os registros de ponto',
      onResponse: (response) => {
        const header = response.headers.get('X-Total-Count');
        if (header === null || !/^\d+$/.test(header)) throw new Error('Resposta da API sem total válido de registros de ponto');
        total = Number(header);
      }
    });
    if (!Array.isArray(data)) throw new Error('Resposta inválida ao buscar os registros de ponto');
    return { registros: data, total };
  },

  getRegistrosHoje: async (funcionarioId: number): Promise<PointRecord[]> => {
    const data = await httpClient<PointRecord[]>(`${API_URL}/hoje/${funcionarioId}`, { auth: true, errorMessage: 'Erro ao buscar os registros de hoje' });
    return Array.isArray(data) ? data : [];
  },

  registrar: async (type: string, localizacao?: { lat: number, lng: number }): Promise<PointRecord> => {
    // O servidor identifica o colaborador pelo token; o corpo não leva o id.
    const corpo: CorpoDeRegistroApi = { tipo: type, latitude: localizacao?.lat, longitude: localizacao?.lng };
    return await httpClient<PointRecord>(`${API_URL}/registrar`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify(corpo)
    });
  },

  getHistoricoMes: async (funcionarioId: number, month: string): Promise<HistoryDay[]> => {
    const data = await httpClient<HistoryDay[]>(`${API_URL}/historico/${funcionarioId}?mes=${month}`, { auth: true, errorMessage: 'Erro ao buscar o histórico do mês' });
    if (!Array.isArray(data)) throw new Error('Resposta inválida ao buscar o histórico do mês');
    return data;
  },

  // Resolve só depois que o servidor confirma a gravação; qualquer falha propaga como HttpError.
  salvarJustificativa: async (date: string, texto: string): Promise<void> => {
    await httpClient(`${API_URL}/justificativa/${date}`, {
      method: 'PUT',
      auth: true,
      body: JSON.stringify({ texto })
    });
  },

  getTotaisDoMes: async (funcionarioId: number, month: string): Promise<MonthTotals> => {
    const data = await httpClient<MonthTotals>(`${API_URL}/totais/${funcionarioId}?mes=${month}`, { auth: true, errorMessage: 'Erro ao buscar os totais do mês' });
    if (!Array.isArray(data?.totals) || !data.monthlySummary || !data.workSchedule) throw new Error('Resposta inválida ao buscar os totais do mês');
    return data;
  },

  // Justificativas do mês de todos os colaboradores da empresa, só do `status` pedido quando houver.
  getJustificativas: async (mes: string, status?: JustificationStatus): Promise<Justification[]> => {
    const params = new URLSearchParams({ mes });
    if (status) params.set('status', status);
    const data = await httpClient<Justification[]>(`${API_URL}/justificativas?${params}`, { auth: true, errorMessage: 'Erro ao buscar as justificativas' });
    if (!Array.isArray(data)) throw new Error('Resposta inválida ao buscar as justificativas');
    return data;
  },

  // Resolve com a justificativa já decidida; a recusa precisa do motivo (o servidor recusa sem ele).
  decidirJustificativa: async (id: number, decisao: JustificationDecision): Promise<Justification> => {
    return await httpClient<Justification>(`${API_URL}/justificativas/${id}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(decisao)
    });
  }
};