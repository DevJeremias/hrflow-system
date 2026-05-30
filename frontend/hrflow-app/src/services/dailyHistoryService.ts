// src/services/dailyHistoryService.ts

export interface HistoryDay {
  id: string;
  date: string;
  entry: string;
  lunchOut: string;
  lunchIn: string;
  exit: string;
  totalHours: string;
  negativeAdjust: string;
  positiveAdjust: string;
  status: 'OK' | 'Atraso' | 'Falta';
  note: string;
}

// 1. Adicionamos as interfaces da versão Web[cite: 9]
export interface WeeklyTotal {
  id: string;
  weekLabel: string;
  workloadLimit: string;
  workloadPreset: string;
  workloadDone: string;
  presenceTime: string;
  pendingTime: string;
  excessTime: string;
  dailyAdjustBalance: string;
}

export type MonthlySummary = Omit<WeeklyTotal, 'id' | 'weekLabel'>;

export const dailyHistoryService = {
  
  async getMonthlyHistory(month: string): Promise<HistoryDay[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { id: '1', date: '28/05/2026', entry: '08:00', lunchOut: '12:00', lunchIn: '13:00', exit: '17:00', totalHours: '08:00', negativeAdjust: '00:00', positiveAdjust: '00:00', status: 'OK', note: '' },
          { id: '2', date: '27/05/2026', entry: '08:15', lunchOut: '12:05', lunchIn: '13:00', exit: '17:10', totalHours: '08:00', negativeAdjust: '00:15', positiveAdjust: '00:10', status: 'Atraso', note: 'Trânsito intenso' },
          { id: '3', date: '26/05/2026', entry: '07:55', lunchOut: '12:00', lunchIn: '12:55', exit: '17:00', totalHours: '08:10', negativeAdjust: '00:00', positiveAdjust: '00:10', status: 'OK', note: '' },
        ]);
      }, 800);
    });
  },

  // 2. Nova função que devolve os Totais da Semana e o Resumo do Mês[cite: 9, 11]
  async getWeeklyTotals(month: string): Promise<{ totals: WeeklyTotal[], monthlySummary: MonthlySummary }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          totals: [
            { id: '1', weekLabel: 'Semana 1', workloadLimit: '44:00', workloadPreset: '40:00', workloadDone: '40:10', presenceTime: '40:10', pendingTime: '00:00', excessTime: '00:10', dailyAdjustBalance: '+00:10' },
            { id: '2', weekLabel: 'Semana 2', workloadLimit: '44:00', workloadPreset: '40:00', workloadDone: '39:45', presenceTime: '39:45', pendingTime: '00:15', excessTime: '00:00', dailyAdjustBalance: '-00:15' }
          ],
          monthlySummary: { workloadLimit: '220:00', workloadPreset: '200:00', workloadDone: '198:00', presenceTime: '198:00', pendingTime: '02:30', excessTime: '00:30', dailyAdjustBalance: '-02:00' }
        });
      }, 800);
    });
  },

  async saveNote(id: string, note: string): Promise<boolean> {
    return new Promise((resolve) => setTimeout(() => resolve(true), 500));
  },

  // 3. Atualizamos o PDF para incluir a Tabela de Totais Semanais[cite: 9]
  generatePDFTemplate(data: HistoryDay[], totals: WeeklyTotal[], summary: MonthlySummary, monthName: string): string {
    const historyRows = data.map(day => `
      <tr>
        <td><strong>${day.date}</strong></td>
        <td style="text-align: center;">${day.entry}</td>
        <td style="text-align: center;">${day.lunchOut}</td>
        <td style="text-align: center;">${day.lunchIn}</td>
        <td style="text-align: center;">${day.exit}</td>
        <td style="text-align: center;"><strong>${day.totalHours}</strong></td>
        <td style="text-align: center; color: #e11d48;">${day.negativeAdjust !== '00:00' ? day.negativeAdjust : '-'}</td>
        <td style="text-align: center; color: #0284c7;">${day.positiveAdjust !== '00:00' ? day.positiveAdjust : '-'}</td>
        <td style="text-align: center;">${day.status}</td>
        <td style="font-size: 10px; color: #64748b; max-width: 100px;">${day.note || '-'}</td>
      </tr>
    `).join('');

    const totalsRows = totals.map(week => `
      <tr>
        <td><strong>${week.weekLabel}</strong></td>
        <td style="text-align: center;">${week.workloadLimit}</td>
        <td style="text-align: center;">${week.workloadPreset}</td>
        <td style="text-align: center;">${week.workloadDone}</td>
        <td style="text-align: center;"><strong>${week.presenceTime}</strong></td>
        <td style="text-align: center; color: #e11d48;">${week.pendingTime}</td>
        <td style="text-align: center; color: #059669;">${week.excessTime}</td>
        <td style="text-align: center; font-weight: bold; color: ${week.dailyAdjustBalance.startsWith('-') ? '#e11d48' : '#0284c7'};">${week.dailyAdjustBalance}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="pt-PT">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 30px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #ea580c; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: bold; }
          .title span { color: #ea580c; }
          .emp-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; display: flex; justify-content: space-between;}
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 11px; }
          th { background-color: #f1f5f9; color: #475569; font-weight: bold; text-transform: uppercase; padding: 10px; border-bottom: 2px solid #e2e8f0; }
          td { padding: 10px; border-bottom: 1px solid #f1f5f9; }
          tr:nth-child(even) { background-color: #fcfcfc; }
          .section-title { font-size: 14px; font-weight: bold; color: #334155; margin-bottom: 10px; margin-top: 30px; text-transform: uppercase; border-left: 4px solid #ea580c; padding-left: 10px; }
          .summary-row { background-color: #f1f5f9; font-weight: bold; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">HR<span>Flow</span> - Espelho de Ponto Oficial</div>
          <div style="font-size: 14px; font-weight: bold; color: #64748b;">${monthName}</div>
        </div>
        
        <div class="emp-info">
          <div><strong>Colaborador:</strong> Marcos Brigida<br><strong>Cargo:</strong> Fullstack Developer</div>
          <div style="text-align: right;"><strong>Departamento:</strong> TI<br><strong>Emissão:</strong> ${new Date().toLocaleDateString('pt-PT')}</div>
        </div>

        <div class="section-title">Registos Diários</div>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Entrada</th><th>Pausa</th><th>Retorno</th><th>Saída</th>
              <th>Presença</th>
              <th style="color: #e11d48;">- Aj.</th><th style="color: #0284c7;">+ Aj.</th>
              <th>Status</th><th>Justificativa</th>
            </tr>
          </thead>
          <tbody>${historyRows}</tbody>
        </table>

        <div class="section-title">Totais Semanais e Mensal</div>
        <table>
          <thead>
            <tr>
              <th>Semana</th>
              <th>Limite</th><th>Preestab.</th><th>Cumprida</th>
              <th>Presença</th>
              <th>Pendente</th><th>Excedente</th>
              <th>Saldo Ajuste</th>
            </tr>
          </thead>
          <tbody>
            ${totalsRows}
            <tr class="summary-row">
              <td style="text-transform: uppercase;">Total Mensal</td>
              <td style="text-align: center;">${summary.workloadLimit}</td>
              <td style="text-align: center;">${summary.workloadPreset}</td>
              <td style="text-align: center;">${summary.workloadDone}</td>
              <td style="text-align: center;">${summary.presenceTime}</td>
              <td style="text-align: center; color: #e11d48;">${summary.pendingTime}</td>
              <td style="text-align: center; color: #059669;">${summary.excessTime}</td>
              <td style="text-align: center; color: ${summary.dailyAdjustBalance.startsWith('-') ? '#e11d48' : '#0284c7'}; font-size: 14px;">${summary.dailyAdjustBalance}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
  }
};