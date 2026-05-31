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

// Utilitário para montar o cabeçalho com o Token do usuário logado
const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

// A rota correta (no singular) do seu Back-end
const API_URL = 'http://localhost:3000/api/ponto'; 

export const pontoService = {
  
  getRegistrosHoje: async (): Promise<PointRecord[]> => {
    const funcionarioId = localStorage.getItem('funcionarioId');
    try {
      const res = await fetch(`${API_URL}/hoje/${funcionarioId}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  registrar: async (type: string, localizacao?: { lat: number, lng: number }): Promise<PointRecord> => {
    const id = localStorage.getItem('funcionarioId');
    
    const res = await fetch(`${API_URL}/registrar`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ 
        funcionario_id: id, // A variável exatamente como o seu Node.js pede
        tipo: type, 
        localizacao 
      })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.mensagem || err.erro || 'Erro ao registrar o ponto.');
    }
    
    return await res.json();
  },

  getHistoricoMes: async (month: string): Promise<HistoryDay[]> => {
    const funcionarioId = localStorage.getItem('funcionarioId');
    try {
      const res = await fetch(`${API_URL}/historico/${funcionarioId}?mes=${month}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return []; 
    }
  },

  salvarJustificativa: async (id: string, note: string): Promise<void> => {
    await fetch(`${API_URL}/justificativa/${id}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ note })
    });
  },

  getTotaisSemanais: async (month: string): Promise<{ totals: WeeklyTotal[], monthlySummary: Omit<WeeklyTotal, 'id' | 'weekLabel'> }> => {
    const funcionarioId = localStorage.getItem('funcionarioId');
    try {
      const res = await fetch(`${API_URL}/totais/${funcionarioId}?mes=${month}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      // Fallback seguro caso a rota falhe
      return { 
        totals: [], 
        monthlySummary: { workloadLimit: '00:00', workloadPreset: '00:00', workloadDone: '00:00', presenceTime: '00:00', pendingTime: '00:00', excessTime: '00:00', hoursBank: '00:00', dailyAdjustBalance: '00:00' } 
      };
    }
  }
};