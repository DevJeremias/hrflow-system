import React, { useState } from 'react';
import { Calendar, MessageSquare, PlusCircle, Layers, X, AlertCircle } from 'lucide-react';
import { HistoryDay, MonthTotals, PeriodTotals } from '../../services/pontoService';
import { ROTULO_DA_JUSTIFICATIVA, diaDaSemana, diaTemMarcacao, formatarDataIso, hojeDeBelem, podeJustificar, rotuloDoDia } from '../../utils/ponto';

const CLASSE_DO_STATUS: Record<HistoryDay['status'], string> = {
  ok: 'bg-emerald-50 text-emerald-600',
  atraso: 'bg-amber-50 text-amber-600',
  incompleto: 'bg-amber-50 text-amber-600',
  falta: 'bg-rose-50 text-rose-600',
  justificado: 'bg-indigo-50 text-indigo-600',
  fim_de_semana: 'bg-slate-100 text-slate-400',
};

const CLASSE_DA_JUSTIFICATIVA = {
  pendente: 'bg-amber-50 text-amber-600',
  aprovada: 'bg-emerald-50 text-emerald-600',
  recusada: 'bg-rose-50 text-rose-600',
};

// ==========================================
// SUBCOMPONENTE: MODAL DE JUSTIFICATIVA
// ==========================================
interface NoteModalProps {
  day: HistoryDay;
  noteText: string;
  setNoteText: (text: string) => void;
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSave: () => void;
}

// O que o colaborador precisa saber sobre o destino da justificativa neste dia.
const avisoDoModal = (day: HistoryDay): { texto: string; classe: string } => {
  if (day.noteStatus === 'aprovada') {
    return { texto: 'O RH aprovou esta justificativa. O dia está abonado e o texto não pode mais ser alterado.', classe: 'bg-emerald-50 border-emerald-100 text-emerald-800' };
  }
  if (day.noteStatus === 'recusada') {
    return { texto: `O RH recusou esta justificativa${day.noteReply ? `: ${day.noteReply}` : '.'} Você pode corrigir o texto e reenviar para uma nova análise.`, classe: 'bg-rose-50 border-rose-100 text-rose-800' };
  }
  if (day.noteStatus === 'pendente') {
    return { texto: 'Aguardando a análise do RH. Enquanto isso você pode corrigir o texto.', classe: 'bg-amber-50 border-amber-100 text-amber-800' };
  }
  return { texto: 'Sua justificativa será enviada ao RH, que vai aprová-la ou recusá-la. Você acompanha a resposta neste espelho.', classe: 'bg-amber-50 border-amber-100 text-amber-800' };
};

const TimeNoteModal: React.FC<NoteModalProps> = ({ day, noteText, setNoteText, isSaving, error, onClose, onSave }) => {
  const aviso = avisoDoModal(day);
  const somenteLeitura = day.noteStatus === 'aprovada';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-justificativa" className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl relative z-10 p-8 animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 id="titulo-justificativa" className="text-xl font-black text-slate-900">{day.noteStatus ? 'Justificativa' : 'Adicionar Justificativa'}</h3>
            <p className="text-sm font-bold text-slate-500 mt-1">Ref: {formatarDataIso(day.date)}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div className={`p-4 border rounded-xl ${aviso.classe}`}>
            <p className="text-xs font-bold flex gap-2">
              <AlertCircle size={16} className="shrink-0" />
              {aviso.texto}
            </p>
          </div>
          <textarea 
            value={noteText} onChange={(e) => setNoteText(e.target.value)} disabled={isSaving || somenteLeitura} maxLength={1000}
            aria-label="Texto da justificativa"
            placeholder="Ex: Fui ao médico e tenho atestado..."
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-primary resize-none h-32 text-sm font-medium text-slate-700"
          />
          {error && (
            <p role="alert" className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">{error}</p>
          )}
          {!somenteLeitura && (
            <button onClick={onSave} disabled={isSaving || !noteText.trim()} className="w-full py-4 bg-slate-900 hover:bg-primary disabled:opacity-60 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-xl transition-all active:scale-95">
              {isSaving ? 'Enviando...' : day.noteStatus === 'recusada' ? 'Reenviar Justificativa' : 'Enviar Justificativa'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SUBCOMPONENTES DO DIA (tabela e cartões compartilham)
// ==========================================
const StatusDoDia: React.FC<{ day: HistoryDay }> = ({ day }) => (
  <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider leading-tight ${day.open && day.status === 'ok' ? 'text-slate-300' : CLASSE_DO_STATUS[day.status]}`}>{rotuloDoDia(day)}</span>
);

// A nota do dia: o botão que abre a justificativa já enviada, ou o que abre uma nova em qualquer dia útil.
const AcaoDaNota: React.FC<{ day: HistoryDay; hoje: string; onOpen: (day: HistoryDay) => void }> = ({ day, hoje, onOpen }) => {
  const data = formatarDataIso(day.date);
  if (day.note) {
    return (
      <button onClick={() => onOpen(day)} aria-label={`Justificativa de ${data}, ${ROTULO_DA_JUSTIFICATIVA[day.noteStatus ?? 'pendente']}`} title={day.note} className="inline-flex flex-col items-start gap-1 max-w-[130px] px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 hover:text-primary transition-colors text-left">
        {day.noteStatus && (
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${CLASSE_DA_JUSTIFICATIVA[day.noteStatus]}`}>{ROTULO_DA_JUSTIFICATIVA[day.noteStatus]}</span>
        )}
        <span className="flex items-center gap-1.5 max-w-full">
          <MessageSquare size={14} className="shrink-0" />
          <span className="truncate">{day.note}</span>
        </span>
      </button>
    );
  }
  if (!podeJustificar(day, hoje)) return null;
  return (
    <button onClick={() => onOpen(day)} aria-label={`Adicionar nota em ${data}`} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 hover:text-primary hover:bg-indigo-50 rounded-lg transition-colors">
      <PlusCircle size={14} /> Adicionar Nota
    </button>
  );
};

// ==========================================
// COMPONENTE PRINCIPAL: ESPELHO DE PONTO
// ==========================================
interface Props {
  month: string;
  setMonth: (month: string) => void;
  historyData: HistoryDay[];
  monthTotals: MonthTotals | null;
  onSaveNote: (id: string, note: string) => Promise<void>;
}

const DashboardTimeMirror: React.FC<Props> = ({ month, setMonth, historyData, monthTotals, onSaveNote }) => {
  const [selectedDay, setSelectedDay] = useState<HistoryDay | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleOpenNote = (day: HistoryDay) => {
    setSelectedDay(day);
    setNoteText(day.note);
    setSaveError('');
  };

  const hoje = hojeDeBelem();
  const mesSemMarcacoes = !historyData.some(diaTemMarcacao);

  const handleClose = () => {
    if (!isSaving) setSelectedDay(null);
  };

  // O modal só fecha depois que o servidor confirma; na falha ele fica aberto com o texto e o erro.
  const handleSave = async () => {
    if (!selectedDay) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await onSaveNote(selectedDay.id, noteText);
      setSelectedDay(null);
    } catch (error) {
      setSaveError(error instanceof Error && error.message ? error.message : 'Não foi possível enviar a justificativa. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
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
          <input type="month" aria-label="Mês do espelho de ponto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-sm font-bold py-3 px-5 rounded-xl outline-none focus:border-primary cursor-pointer shadow-sm" />
        </div>

        {mesSemMarcacoes && (
          <p role="status" className="px-8 py-4 text-sm font-bold text-slate-500 bg-slate-50 border-b border-slate-100">
            Nenhuma marcação registrada neste mês. Se você trabalhou em algum dia, use "Adicionar Nota" na linha do dia para avisar o RH.
          </p>
        )}

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[860px]">
            <thead>
              <tr className="bg-slate-100/50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-black">
                <th className="px-4 py-3 text-left border-r border-slate-100" rowSpan={2}>Data</th>
                <th className="px-2 py-3 text-center border-r border-slate-100" colSpan={4}>Registros do Dia</th>
                <th className="px-2 py-3 text-center border-r border-slate-100" rowSpan={2}>Horas</th>
                <th className="px-2 py-3 text-center border-r border-slate-100" rowSpan={2}>Atraso</th>
                <th className="px-2 py-3 text-center border-r border-slate-100 bg-blue-50/30" colSpan={2}>Ajuste Diário</th>
                <th className="px-2 py-3 text-center" rowSpan={2}>Status</th>
                <th className="px-4 py-3 text-right" rowSpan={2}>Justificativa</th>
              </tr>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-2 px-2 text-center">Entrada</th>
                <th className="py-2 px-2 text-center">Pausa</th>
                <th className="py-2 px-2 text-center">Retorno</th>
                <th className="py-2 px-2 text-center border-r border-slate-100">Saída</th>
                <th className="py-2 px-2 text-center text-rose-500 bg-rose-50/30 border-r border-slate-100">Negativo</th>
                <th className="py-2 px-2 text-center text-blue-500 bg-blue-50/30 border-r border-slate-100">Positivo</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {historyData.map((day) => (
                <tr key={day.id} className={`hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${day.status === 'fim_de_semana' ? 'bg-slate-50/60 text-slate-400' : ''}`}>
                  <td className="px-4 py-3 font-bold text-slate-900 border-r border-slate-100 whitespace-nowrap">
                    {formatarDataIso(day.date)}
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{diaDaSemana(day.date)}</span>
                  </td>
                  <td className="px-2 py-3 text-center text-slate-600">{day.entry}</td>
                  <td className="px-2 py-3 text-center text-slate-600">{day.lunchOut}</td>
                  <td className="px-2 py-3 text-center text-slate-600">{day.lunchIn}</td>
                  <td className="px-2 py-3 text-center text-slate-600 border-r border-slate-100">{day.exit}</td>
                  <td className="px-2 py-3 text-center font-bold text-slate-900 border-r border-slate-100 bg-slate-50/50">{day.totalHours}</td>
                  <td className={`px-2 py-3 text-center font-bold border-r border-slate-100 ${day.delay !== '00:00' ? 'text-amber-600' : 'text-slate-400'}`}>{day.delay}</td>
                  <td className={`px-2 py-3 text-center font-bold border-r border-slate-100 ${day.negativeAdjust !== '00:00' ? 'text-rose-500' : 'text-slate-400'}`}>{day.negativeAdjust}</td>
                  <td className={`px-2 py-3 text-center font-bold border-r border-slate-100 ${day.positiveAdjust !== '00:00' ? 'text-blue-500' : 'text-slate-400'}`}>{day.positiveAdjust}</td>
                  <td className="px-2 py-3 text-center"><StatusDoDia day={day} /></td>
                  <td className="px-4 py-3 text-right"><AcaoDaNota day={day} hoje={hoje} onOpen={handleOpenNote} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="md:hidden divide-y divide-slate-100">
          {historyData.map((day) => (
            <li key={day.id} className={`p-4 space-y-3 ${day.status === 'fim_de_semana' ? 'bg-slate-50/60' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-slate-900">
                  {formatarDataIso(day.date)} <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{diaDaSemana(day.date)}</span>
                </p>
                <StatusDoDia day={day} />
              </div>
              <dl className="grid grid-cols-4 gap-2 text-center text-sm font-medium text-slate-600">
                {([['Entrada', day.entry], ['Pausa', day.lunchOut], ['Retorno', day.lunchIn], ['Saída', day.exit]] as const).map(([rotulo, horario]) => (
                  <div key={rotulo}>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{rotulo}</dt>
                    <dd>{horario}</dd>
                  </div>
                ))}
              </dl>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
                <span>Horas <span className="text-slate-900">{day.totalHours}</span></span>
                {day.delay !== '00:00' && <span className="text-amber-600">Atraso {day.delay}</span>}
                {day.negativeAdjust !== '00:00' && <span className="text-rose-500">Negativo {day.negativeAdjust}</span>}
                {day.positiveAdjust !== '00:00' && <span className="text-blue-500">Positivo {day.positiveAdjust}</span>}
              </p>
              <div className="flex justify-end"><AcaoDaNota day={day} hoje={hoje} onOpen={handleOpenNote} /></div>
            </li>
          ))}
        </ul>
      </div>

      {/* 2. TOTAIS SEMANAIS E DO MÊS */}
      {monthTotals && monthTotals.totals.length > 0 && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden mt-10">
          <div className="px-8 py-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-primary rounded-xl">
                <Layers size={20} />
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Totais Semanais</h2>
            </div>
            <p className="text-xs font-bold text-slate-500">
              Jornada: {monthTotals.workSchedule.entry} às {monthTotals.workSchedule.exit}, {monthTotals.workSchedule.weeklyHours}h semanais, tolerância de {monthTotals.workSchedule.toleranceMinutes} min
            </p>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-500 font-black">
                  <th className="p-6 font-black text-slate-900">Semana</th>
                  <th className="p-5 text-center">Carga Prevista</th>
                  <th className="p-5 text-center">Horas Trabalhadas</th>
                  <th className="p-5 text-center">Pendente</th>
                  <th className="p-5 text-center">Excedente</th>
                  <th className="p-5 text-center">Atrasos</th>
                  <th className="p-5 text-center">Faltas</th>
                  <th className="p-5 text-center">Incompletos</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-slate-600">
                {monthTotals.totals.map((week) => (
                  <tr key={week.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-6 font-bold text-slate-900">{week.weekLabel}</td>
                    <td className="p-5 text-center">{week.workloadLimit}</td>
                    <td className="p-5 text-center font-bold text-slate-900">{week.workloadDone}</td>
                    <td className={`p-5 text-center ${week.pendingTime !== '00:00' ? 'font-bold text-rose-500' : ''}`}>{week.pendingTime}</td>
                    <td className={`p-5 text-center ${week.excessTime !== '00:00' ? 'font-bold text-blue-500' : ''}`}>{week.excessTime}</td>
                    <td className={`p-5 text-center ${week.delayTime !== '00:00' ? 'font-bold text-amber-600' : ''}`}>{week.delayTime}</td>
                    <td className={`p-5 text-center ${week.absences > 0 ? 'font-bold text-rose-500' : ''}`}>{week.absences}</td>
                    <td className="p-5 text-center">{week.incompleteDays}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100/40 border-t-2 border-slate-200 text-sm">
                  <td className="p-6 font-black text-slate-900 uppercase tracking-wider">Total Mensal</td>
                  <td className="p-6 text-center font-bold text-slate-700">{monthTotals.monthlySummary.workloadLimit}</td>
                  <td className="p-6 text-center font-black text-slate-900">{monthTotals.monthlySummary.workloadDone}</td>
                  <td className="p-6 text-center font-bold text-slate-700">{monthTotals.monthlySummary.pendingTime}</td>
                  <td className="p-6 text-center font-bold text-emerald-600">{monthTotals.monthlySummary.excessTime}</td>
                  <td className="p-6 text-center font-bold text-slate-700">{monthTotals.monthlySummary.delayTime}</td>
                  <td className="p-6 text-center font-bold text-slate-700">{monthTotals.monthlySummary.absences}</td>
                  <td className="p-6 text-center font-bold text-slate-700">{monthTotals.monthlySummary.incompleteDays}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <ul className="md:hidden divide-y divide-slate-100">
            {[...monthTotals.totals.map((week) => ({ chave: week.id, rotulo: week.weekLabel, totais: week as PeriodTotals, destaque: false })), { chave: 'mes', rotulo: 'Total mensal', totais: monthTotals.monthlySummary, destaque: true }].map(({ chave, rotulo, totais, destaque }) => (
              <li key={chave} className={`p-4 space-y-2 ${destaque ? 'bg-slate-100/40' : ''}`}>
                <p className={`font-black ${destaque ? 'uppercase tracking-wider text-slate-900' : 'text-slate-900'}`}>{rotulo}</p>
                <p className="text-sm font-medium text-slate-600">
                  <span className="font-bold text-slate-900">{totais.workloadDone}</span> trabalhadas de {totais.workloadLimit} previstas
                </p>
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
                  {totais.pendingTime !== '00:00' && <span className="text-rose-500">Pendente {totais.pendingTime}</span>}
                  {totais.excessTime !== '00:00' && <span className="text-blue-500">Excedente {totais.excessTime}</span>}
                  {totais.delayTime !== '00:00' && <span className="text-amber-600">Atrasos {totais.delayTime}</span>}
                  {totais.absences > 0 && <span className="text-rose-500">Faltas {totais.absences}</span>}
                  {totais.incompleteDays > 0 && <span>Incompletos {totais.incompleteDays}</span>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. MODAL */}
      {selectedDay && (
        <TimeNoteModal 
          day={selectedDay}
          noteText={noteText} setNoteText={setNoteText} 
          isSaving={isSaving} error={saveError} onClose={handleClose} onSave={handleSave} 
        />
      )}
    </div>
  );
};

export default DashboardTimeMirror;
