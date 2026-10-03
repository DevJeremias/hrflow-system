import httpClient from './httpClient';

// src/services/pontoService.ts

export interface PointRecord {
  id: string;
  type: 'Entrada' | 'Pausa Almoço' | 'Retorno Almoço' | 'Saída' | string;
  time: string; 
  date: string; 
}

export type DayStatus = 'ok' | 'atraso' | 'incompleto' | 'falta' | 'justificado' | 'fim_de_semana';

export type JustificationStatus = 'pendente' | 'aprovada' | 'recusada';

// `open` marca o dia ainda sem apuração (futuro, hoje sem saída ou antes da admissão); `delay` e os
// ajustes são 'HH:MM'; `note*` é a justificativa do colaborador e o que o RH decidiu sobre ela.
export interface HistoryDay {
  id: string;
  date: string; 
  entry: string;
  lunchOut: string;
  lunchIn: string;
  exit: string;
  totalHours: string;
  status: DayStatus;
  open: boolean;
  delay: string;
  note: string;
  noteStatus: JustificationStatus | null;
  noteReply: string | null;
  negativeAdjust: string;
  positiveAdjust: string;
}

export interface CompanyPointRecord {
  id: number;
  funcionario_id: number;
  tipo_registro: string;
  nome_funcionario: string;
  date: string;
  time: string;
}

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

export interface PeriodTotals {
  workloadLimit: string;
  workloadDone: string;
  pendingTime: string;
  excessTime: string;
  delayTime: string;
  absences: number;
  incompleteDays: number;
}

export interface WeeklyTotal extends PeriodTotals {
  id: string;
  weekLabel: string;
}

export interface WorkSchedule {
  weeklyHours: number;
  entry: string;
  exit: string;
  toleranceMinutes: number;
}

export interface MonthTotals {
  workSchedule: WorkSchedule;
  totals: WeeklyTotal[];
  monthlySummary: PeriodTotals;
}

export interface Justification {
  id: number;
  funcionario_id: number;
  nome_funcionario: string;
  date: string;
  note: string;
  status: JustificationStatus;
  reply: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JustificationDecision {
  status: 'aprovada' | 'recusada';
  resposta?: string;
}

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
    const data = await httpClient(`${API_URL}/hoje/${funcionarioId}`, { auth: true, errorMessage: 'Erro ao buscar os registros de hoje' });
    return Array.isArray(data) ? data : [];
  },

  registrar: async (type: string, localizacao?: { lat: number, lng: number }): Promise<PointRecord> => {
    // O servidor identifica o colaborador pelo token; o corpo não leva o id.
    const res = await httpClient(`${API_URL}/registrar`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ 
        tipo: type, 
        latitude: localizacao?.lat,
        longitude: localizacao?.lng
      })
    });
    
    return res;
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
    return await httpClient(`${API_URL}/justificativas/${id}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(decisao)
    });
  }
};