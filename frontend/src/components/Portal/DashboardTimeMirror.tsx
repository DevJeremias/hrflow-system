import React, { useState } from 'react';
import { Calendar, MessageSquare, PlusCircle, Layers, X, AlertCircle } from 'lucide-react';
import { HistoryDay, WeeklyTotal } from '../../services/pontoService';

// ==========================================
// SUBCOMPONENTE: MODAL DE JUSTIFICATIVA
// ==========================================
interface NoteModalProps {
  dateRef: string;
  noteText: string;
  setNoteText: (text: string) => void;
  onClose: () => void;
  onSave: () => void;
}

const TimeNoteModal: React.FC<NoteModalProps> = ({ dateRef, noteText, setNoteText, onClose, onSave }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
    <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl relative z-10 p-8 animate-in zoom-in-95 duration-300">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-black text-slate-900">Adicionar Justificativa</h3>
          <p className="text-sm font-bold text-slate-500 mt-1">Ref: {dateRef}</p>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
      </div>
      <div className="space-y-4">
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-xs font-bold text-amber-800 flex gap-2">
            <AlertCircle size={16} className="shrink-0" />
            Sua justificativa será enviada para o RH e estará sujeita a aprovação do seu gestor.
          </p>
        </div>
        <textarea 
          value={noteText} onChange={(e) => setNoteText(e.target.value)}
          placeholder="Ex: Fui ao médico e tenho atestado..."
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-primary resize-none h-32 text-sm font-medium text-slate-700"
        />
        <button onClick={onSave} className="w-full py-4 bg-slate-900 hover:bg-primary text-white font-black rounded-2xl shadow-xl transition-all active:scale-95">
          Salvar Anotação
        </button>
      </div>
    </div>
  </div>
);

// ==========================================
// COMPONENTE PRINCIPAL: ESPELHO DE PONTO
// ==========================================
interface Props {
  month: string;
  setMonth: (month: string) => void;
  historyData: HistoryDay[];
  weeklyData: WeeklyTotal[];
  monthlySummary: Omit<WeeklyTotal, 'id' | 'weekLabel'> | null;
  onSaveNote: (id: string, note: string) => void;
}

const DashboardTimeMirror: React.FC<Props> = ({ month, setMonth, historyData, weeklyData, monthlySummary, onSaveNote }) => {
  const [selectedDay, setSelectedDay] = useState<HistoryDay | null>(null);
  const [noteText, setNoteText] = useState('');

  const handleOpenNote = (day: HistoryDay) => {
    setSelectedDay(day);
    setNoteText(day.note);
  };

  const handleSave = () => {
    if (selectedDay) onSaveNote(selectedDay.id, noteText);
    setSelectedDay(null);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      
      {/* 1. TABELA DE HISTÓRICO DIÁRIO */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden mt-10">
        <div className="px-8 py-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50/50 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-primary rounded-xl"><Calendar size={20} /></div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Espelho de Ponto Diário</h2>
          </div>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-sm font-bold py-3 px-5 rounded-xl outline-none focus:border-primary cursor-pointer shadow-sm" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-100/50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-black">
                <th className="p-6 text-left border-r border-slate-100" rowSpan={2}>Data</th>
                <th className="p-4 text-center border-r border-slate-100" colSpan={4}>Registros do Dia</th>
                <th className="p-4 text-center border-r border-slate-100" rowSpan={2}>Tempo Presença</th>
                <th className="p-4 text-center border-r border-slate-100 bg-blue-50/30" colSpan={2}>Ajuste Diário</th>
                <th className="p-6 text-center" rowSpan={2}>Status</th>
                <th className="p-6 text-right" rowSpan={2}>Justificativa</th>
              </tr>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                <th className="py-3 px-4 text-center">Entrada</th>
                <th className="py-3 px-4 text-center">Pausa</th>
                <th className="py-3 px-4 text-center">Retorno</th>
                <th className="py-3 px-4 text-center border-r border-slate-100">Saída</th>
                <th className="py-3 px-4 text-center text-rose-500 bg-rose-50/30 border-r border-slate-100">Negativo</th>
                <th className="py-3 px-4 text-center text-blue-500 bg-blue-50/30 border-r border-slate-100">Positivo</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {historyData.map((day) => (
                <tr key={day.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group">
                  <td className="p-6 font-bold text-slate-900 border-r border-slate-100">{day.date.split('-').reverse().join('/')}</td>
                  <td className="p-4 text-center text-slate-600">{day.entry}</td>
                  <td className="p-4 text-center text-slate-600">{day.lunchOut}</td>
                  <td className="p-4 text-center text-slate-600">{day.lunchIn}</td>
                  <td className="p-4 text-center text-slate-600 border-r border-slate-100">{day.exit}</td>
                  <td className="p-4 text-center font-bold text-slate-900 border-r border-slate-100 bg-slate-50/50">{day.totalHours}</td>
                  <td className={`p-4 text-center font-bold border-r border-slate-100 ${day.negativeAdjust !== '00:00' ? 'text-rose-500' : 'text-slate-400'}`}>{day.negativeAdjust}</td>
                  <td className={`p-4 text-center font-bold border-r border-slate-100 ${day.positiveAdjust !== '00:00' ? 'text-blue-500' : 'text-slate-400'}`}>{day.positiveAdjust}</td>
                  <td className="p-6 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${day.status === 'OK' ? 'bg-emerald-50 text-emerald-600' : day.status === 'Atraso' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>{day.status}</span>
                  </td>
                  <td className="p-6 text-right">
                    {day.note ? (
                      <button onClick={() => handleOpenNote(day)} className="inline-flex items-center gap-2 max-w-[120px] px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 hover:text-primary transition-colors text-left float-right">
                        <MessageSquare size={14} className="shrink-0" /><span className="truncate">{day.note}</span>
                      </button>
                    ) : (
                      <button onClick={() => handleOpenNote(day)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-400 hover:text-primary hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 float-right">
                        <PlusCircle size={14} /> Adicionar Nota
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. TABELA DE TOTAIS SEMANAIS */}
      {weeklyData && weeklyData.length > 0 && monthlySummary && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden mt-10">
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
                {weeklyData.map((week) => (
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
      )}

      {/* 3. MODAL */}
      {selectedDay && (
        <TimeNoteModal 
          dateRef={selectedDay.date.split('-').reverse().join('/')} 
          noteText={noteText} setNoteText={setNoteText} 
          onClose={() => setSelectedDay(null)} onSave={handleSave} 
        />
      )}
    </div>
  );
};

export default DashboardTimeMirror;