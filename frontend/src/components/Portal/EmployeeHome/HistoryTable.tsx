import React, { useState } from 'react';
import { Calendar, MessageSquare, PlusCircle } from 'lucide-react';
import NoteModal from './NoteModal';
import { HistoryDay } from '../../../services/pontoService';

interface Props {
  month: string;
  setMonth: (month: string) => void;
  data: HistoryDay[];
  onSaveNote: (id: string, note: string) => void;
}

const HistoryTable: React.FC<Props> = ({ month, setMonth, data, onSaveNote }) => {
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
            {data.map((day) => (
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

      {selectedDay && (
        <NoteModal 
          dateRef={selectedDay.date.split('-').reverse().join('/')} 
          noteText={noteText} setNoteText={setNoteText} 
          onClose={() => setSelectedDay(null)} onSave={handleSave} 
        />
      )}
    </div>
  );
};

export default HistoryTable;