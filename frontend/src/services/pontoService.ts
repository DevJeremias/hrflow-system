import httpClient from './httpClient';

// src/services/pontoService.ts

export interface PointRecord {
  id: string;
  type: 'Entrada' | 'Pausa Almoço' | 'Retorno Almoço' | 'Saída' | string;
  time: string; 
  date: string; 
}

export interface HistoryDay {
  id: string;
  date: string; 
  entry: string;
  lunchOut: string;
  lunchIn: string;
  exit: string;
  totalHours: string;
  status: 'OK' | 'Atraso' | 'Falta' | 'Incompleto';
  note: string;
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

export interface WeeklyTotal {
  id: string;
  weekLabel: string;
  workloadLimit: string;
  workloadPreset: string;
  workloadDone: string;
  presenceTime: string;
  pendingTime: string;
  excessTime: string;
  hoursBank: string;
  dailyAdjustBalance: string;
}

// A rota correta (no singular) do seu Back-end
const API_URL = '/ponto'; 

export const pontoService = {
  getRegistrosDaEmpresa: async (): Promise<CompanyPointRecord[]> => {
    const data = await httpClient<CompanyPointRecord[]>(API_URL, {
      auth: true,
      errorMessage: 'Erro ao buscar os registros de ponto'
    });
    if (!Array.isArray(data)) throw new Error('Resposta inválida ao buscar os registros de ponto');
    return data;
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
    return await httpClient(`${API_URL}/historico/${funcionarioId}?mes=${month}`, { auth: true, errorMessage: 'Erro ao buscar o histórico do mês' });
  },

  // Resolve só depois que o servidor confirma a gravação; qualquer falha propaga como HttpError.
  salvarJustificativa: async (date: string, texto: string): Promise<void> => {
    await httpClient(`${API_URL}/justificativa/${date}`, {
      method: 'PUT',
      auth: true,
      body: JSON.stringify({ texto })
    });
  },

  getTotaisSemanais: async (funcionarioId: number, month: string): Promise<{ totals: WeeklyTotal[], monthlySummary: Omit<WeeklyTotal, 'id' | 'weekLabel'> }> => {
    return await httpClient(`${API_URL}/totais/${funcionarioId}?mes=${month}`, { auth: true, errorMessage: 'Erro ao buscar os totais do mês' });
  }
};