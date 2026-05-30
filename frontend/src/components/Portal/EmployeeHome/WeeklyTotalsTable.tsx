import React from 'react';
import { WeeklyTotal } from '../../../services/pontoService';
import { Layers } from 'lucide-react';

interface Props {
  data: WeeklyTotal[];
  monthlySummary: Omit<WeeklyTotal, 'id' | 'weekLabel'> | null;
}

const WeeklyTotalsTable: React.FC<Props> = ({ data, monthlySummary }) => {
  if (!data || data.length === 0 || !monthlySummary) return null;

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden mt-10">
      
      {/* Cabeçalho da Tabela */}
      <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
        <div className="p-2.5 bg-indigo-50 text-primary rounded-xl">
          <Layers size={20} />
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Totais Semanais</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-500 font-black">
              <th className="p-6 font-black text-slate-900">Semana</th>
              <th className="p-5 text-center">Carga Horária de Trabalho</th>
              <th className="p-5 text-center">Carga Horária Preestabelecida</th>
              <th className="p-5 text-center">Carga Horária Cumprida</th>
              <th className="p-5 text-center">Tempo Presença</th>
              <th className="p-5 text-center">Tempo Pendente</th>
              <th className="p-5 text-center">Excedente</th>
              <th className="p-5 text-center font-black text-slate-900 border-l border-slate-100">Saldo Ajuste Diário</th>
            </tr>
          </thead>
          <tbody className="text-sm font-medium text-slate-600">
            {data.map((week) => (
              <tr key={week.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="p-6 font-bold text-slate-900">{week.weekLabel}</td>
                <td className="p-5 text-center">{week.workloadLimit}</td>
                <td className="p-5 text-center">{week.workloadPreset}</td>
                <td className="p-5 text-center">{week.workloadDone}</td>
                <td className="p-5 text-center">{week.presenceTime}</td>
                <td className="p-5 text-center">{week.pendingTime}</td>
                <td className="p-5 text-center">{week.excessTime}</td>
                <td className={`p-5 text-center font-black border-l border-slate-100 ${week.dailyAdjustBalance.startsWith('-') ? 'text-rose-500' : 'text-blue-500'}`}>
                  {week.dailyAdjustBalance}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100/40 border-t-2 border-slate-200 text-sm">
              <td className="p-6 font-black text-slate-900 uppercase tracking-wider">Total Mensal</td>
              <td className="p-6 text-center font-bold text-slate-700">{monthlySummary.workloadLimit}</td>
              <td className="p-6 text-center font-bold text-slate-700">{monthlySummary.workloadPreset}</td>
              <td className="p-6 text-center font-black text-slate-900">{monthlySummary.workloadDone}</td>
              <td className="p-6 text-center font-black text-slate-900">{monthlySummary.presenceTime}</td>
              <td className="p-6 text-center font-bold text-slate-700">{monthlySummary.pendingTime}</td>
              <td className="p-6 text-center font-bold text-emerald-600">{monthlySummary.excessTime}</td>
              <td className="p-6 text-center font-black text-blue-500 border-l border-slate-100 text-lg">
                {monthlySummary.dailyAdjustBalance}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default WeeklyTotalsTable;