// src/services/pontoService.ts

export interface PointRecord {
  id: string;
  type: 'Entrada' | 'Pausa Almoço' | 'Retorno Almoço' | 'Saída';
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
  totalHours: string; // Agora representará o "Tempo Presença"
  status: 'OK' | 'Atraso' | 'Falta' | 'Incompleto';
  note: string;
  negativeAdjust: string; // Ex: "00:17"
  positiveAdjust: string; // Ex: "00:18"
}

export interface WeeklyTotal {
  id: string;
  weekLabel: string;
  workloadLimit: string;     // Carga Horária de Trabalho
  workloadPreset: string;    // Carga Horária Preestabelecida
  workloadDone: string;      // Carga Horária Cumprida
  presenceTime: string;      // Tempo Presença
  pendingTime: string;       // Tempo Pendente
  excessTime: string;        // Excedente
  hoursBank: string;         // Banco de Horas
  dailyAdjustBalance: string;// Saldo Ajuste Diário
}

export const pontoService = {
  getRegistrosHoje: async (): Promise<PointRecord[]> => {
    /* ... seu código existente ... */
    return [];
  },

  registrar: async (type: PointRecord['type']): Promise<PointRecord> => {
     /* ... seu código existente ... */
     return {} as PointRecord;
  },

  getHistoricoMes: async (month: string): Promise<HistoryDay[]> => {
    await new Promise(resolve => setTimeout(resolve, 600));
    return [
      { id: '1', date: `${month}-15`, entry: '08:00', lunchOut: '12:00', lunchIn: '13:00', exit: '17:00', totalHours: '08:00', status: 'OK', note: '', negativeAdjust: '00:00', positiveAdjust: '00:00' },
      { id: '2', date: `${month}-16`, entry: '08:17', lunchOut: '12:00', lunchIn: '13:00', exit: '17:18', totalHours: '08:01', status: 'Atraso', note: 'Trânsito.', negativeAdjust: '00:17', positiveAdjust: '00:18' },
      { id: '3', date: `${month}-17`, entry: '08:00', lunchOut: '12:00', lunchIn: '13:00', exit: '17:29', totalHours: '08:29', status: 'OK', note: '', negativeAdjust: '00:00', positiveAdjust: '00:29' },
    ];
  },

  salvarJustificativa: async (id: string, note: string): Promise<void> => {
    /* ... seu código existente ... */
  },

  // NOVO MÉTODO PARA A TABELA SEMANAL
  getTotaisSemanais: async (month: string): Promise<{ totals: WeeklyTotal[], monthlySummary: Omit<WeeklyTotal, 'id' | 'weekLabel'> }> => {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const mockTotals: WeeklyTotal[] = [
      { id: 'w1', weekLabel: 'Semana 1', workloadLimit: '00:00', workloadPreset: '00:00', workloadDone: '00:00', presenceTime: '00:00', pendingTime: '00:00', excessTime: '00:00', hoursBank: '00:00', dailyAdjustBalance: '00:00' },
      { id: 'w2', weekLabel: 'Semana 2', workloadLimit: '40:00', workloadPreset: '20:00', workloadDone: '21:00', presenceTime: '21:00', pendingTime: '00:00', excessTime: '00:00', hoursBank: '00:00', dailyAdjustBalance: '01:00' },
      { id: 'w3', weekLabel: 'Semana 3', workloadLimit: '40:00', workloadPreset: '20:00', workloadDone: '19:58', presenceTime: '22:15', pendingTime: '00:00', excessTime: '02:17', hoursBank: '00:00', dailyAdjustBalance: '-00:02' },
      { id: 'w4', weekLabel: 'Semana 4', workloadLimit: '40:00', workloadPreset: '20:00', workloadDone: '00:00', presenceTime: '00:00', pendingTime: '00:00', excessTime: '00:00', hoursBank: '00:00', dailyAdjustBalance: '00:00' },
    ];

    const monthlySummary = {
      workloadLimit: '120:00',
      workloadPreset: '60:00',
      workloadDone: '40:58',
      presenceTime: '43:15',
      pendingTime: '00:00',
      excessTime: '02:17',
      hoursBank: '00:00',
      dailyAdjustBalance: '00:58'
    };

    return { totals: mockTotals, monthlySummary };
  }
};