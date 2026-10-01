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
  
  getRegistrosHoje: async (): Promise<PointRecord[]> => {
    const funcionarioId = localStorage.getItem('funcionarioId');
    try {
      const data = await httpClient(`${API_URL}/hoje/${funcionarioId}`, { auth: true });
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  registrar: async (type: string, localizacao?: { lat: number, lng: number }): Promise<PointRecord> => {
    const id = localStorage.getItem('funcionarioId');
    
    const res = await httpClient(`${API_URL}/registrar`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ 
        funcionario_id: id, // A variável exatamente como o seu Node.js pede
        tipo: type, 
        localizacao 
      })
    });
    
    return res;
  },

  getHistoricoMes: async (month: string): Promise<HistoryDay[]> => {
    const funcionarioId = localStorage.getItem('funcionarioId');
    try {
      return await httpClient(`${API_URL}/historico/${funcionarioId}?mes=${month}`, { auth: true });
    } catch {
      return []; 
    }
  },

  salvarJustificativa: async (id: string, note: string): Promise<void> => {
    await httpClient(`${API_URL}/justificativa/${id}`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ note })
    });
  },

  getTotaisSemanais: async (month: string): Promise<{ totals: WeeklyTotal[], monthlySummary: Omit<WeeklyTotal, 'id' | 'weekLabel'> }> => {
    const funcionarioId = localStorage.getItem('funcionarioId');
    try {
      return await httpClient(`${API_URL}/totais/${funcionarioId}?mes=${month}`, { auth: true });
    } catch {
      // Fallback seguro caso a rota falhe
      return { 
        totals: [], 
        monthlySummary: { workloadLimit: '00:00', workloadPreset: '00:00', workloadDone: '00:00', presenceTime: '00:00', pendingTime: '00:00', excessTime: '00:00', hoursBank: '00:00', dailyAdjustBalance: '00:00' } 
      };
    }
  }
};