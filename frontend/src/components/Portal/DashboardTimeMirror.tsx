import React, { useState } from 'react';
import { Calendar, MessageSquare, PlusCircle, Layers, AlertCircle } from 'lucide-react';
import { HistoryDay, WeeklyTotal } from '../../services/pontoService';
import { formatarDataIso } from '../../utils/ponto';
import Badge, { type BadgeTone } from '../ui/Badge';
import Button from '../ui/Button';
import Card, { CardHeader } from '../ui/Card';
import DataTable, { type Column } from '../ui/DataTable';
import Field, { Input, Textarea } from '../ui/Field';
import Modal from '../ui/Modal';
import ErrorAlert from '../ErrorAlert';

// ==========================================
// SUBCOMPONENTE: MODAL DE JUSTIFICATIVA
// ==========================================
interface NoteModalProps {
  dateRef: string;
  noteText: string;
  setNoteText: (text: string) => void;
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSave: () => void;
}

const TimeNoteModal: React.FC<NoteModalProps> = ({ dateRef, noteText, setNoteText, isSaving, error, onClose, onSave }) => (
  <Modal
    title="Adicionar Justificativa"
    description={`Ref: ${dateRef}`}
    size="sm"
    onClose={() => { if (!isSaving) onClose(); }}
    form={{ onSubmit: (evento) => { evento.preventDefault(); onSave(); } }}
    footer={(
      <Button type="submit" fullWidth size="lg" loading={isSaving} disabled={!noteText.trim()}>
        {isSaving ? 'Enviando...' : 'Enviar Justificativa'}
      </Button>
    )}
  >
    <div className="space-y-4">
      <p className="flex gap-2 rounded-control border border-warning-line bg-warning-soft p-4 text-xs font-semibold text-warning">
        <AlertCircle size={16} aria-hidden="true" className="shrink-0" />
        Sua justificativa será enviada para o RH e estará sujeita a aprovação do seu gestor.
      </p>
      <Field label="Justificativa" name="justificativa">
        <Textarea
          data-autofocus
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          disabled={isSaving}
          maxLength={1000}
          rows={5}
          placeholder="Ex: Fui ao médico e tenho atestado..."
        />
      </Field>
      {error && <ErrorAlert message={error} />}
    </div>
  </Modal>
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
  onSaveNote: (id: string, note: string) => Promise<void>;
}

const STATUS_TOM: Record<string, BadgeTone> = { OK: 'success', Atraso: 'warning' };

const DashboardTimeMirror: React.FC<Props> = ({ month, setMonth, historyData, weeklyData, monthlySummary, onSaveNote }) => {
  const [selectedDay, setSelectedDay] = useState<HistoryDay | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleOpenNote = (day: HistoryDay) => {
    setSelectedDay(day);
    setNoteText(day.note);
    setSaveError('');
  };

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

  const ajuste = (valor: string, tom: string) => <span className={`font-semibold ${valor !== '00:00' ? tom : 'text-ink-muted'}`}>{valor}</span>;

  const dayColumns: Column<HistoryDay>[] = [
    { key: 'date', header: 'Data', cell: (day) => <span className="font-semibold text-ink">{formatarDataIso(day.date)}</span> },
    { key: 'entry', header: 'Entrada', align: 'center', cell: (day) => day.entry },
    { key: 'lunchOut', header: 'Pausa', align: 'center', cell: (day) => day.lunchOut },
    { key: 'lunchIn', header: 'Retorno', align: 'center', cell: (day) => day.lunchIn },
    { key: 'exit', header: 'Saída', align: 'center', cell: (day) => day.exit },
    { key: 'totalHours', header: 'Presença', align: 'center', cell: (day) => <span className="font-semibold text-ink">{day.totalHours}</span> },
    { key: 'negativeAdjust', header: 'Ajuste negativo', align: 'center', cell: (day) => ajuste(day.negativeAdjust, 'text-danger') },
    { key: 'positiveAdjust', header: 'Ajuste positivo', align: 'center', cell: (day) => ajuste(day.positiveAdjust, 'text-info') },
    { key: 'status', header: 'Status', align: 'center', cell: (day) => <Badge tone={STATUS_TOM[day.status] ?? 'danger'}>{day.status}</Badge> },
    {
      key: 'note',
      header: 'Justificativa',
      align: 'right',
      semRotuloNoCartao: true,
      cell: (day) => {
        const data = formatarDataIso(day.date);
        // O nome acessível contém o texto visível (WCAG 2.5.3) e acrescenta a data, para distinguir um dia do outro.
        return day.note ? (
          <Button variant="secondary" size="sm" onClick={() => handleOpenNote(day)} className="max-w-[10rem] justify-start" icon={<MessageSquare size={14} aria-hidden="true" className="shrink-0" />}>
            <span className="sr-only">Justificativa de {data}: </span>
            <span className="truncate">{day.note}</span>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => handleOpenNote(day)} className="whitespace-nowrap" icon={<PlusCircle size={14} aria-hidden="true" />}>
            Adicionar nota<span className="sr-only"> de {data}</span>
          </Button>
        );
      },
    },
  ];

  const resumo = monthlySummary;
  const weekColumns: Column<WeeklyTotal>[] = [
    { key: 'week', header: 'Semana', cell: (week) => <span className="font-semibold text-ink">{week.weekLabel}</span>, footer: 'Total Mensal' },
    { key: 'limit', header: 'Carga horária de trabalho', align: 'center', cell: (week) => week.workloadLimit, footer: resumo?.workloadLimit },
    { key: 'preset', header: 'Carga horária preestabelecida', align: 'center', cell: (week) => week.workloadPreset, footer: resumo?.workloadPreset },
    { key: 'done', header: 'Carga horária cumprida', align: 'center', cell: (week) => week.workloadDone, footer: resumo?.workloadDone },
    { key: 'presence', header: 'Tempo presença', align: 'center', cell: (week) => week.presenceTime, footer: resumo?.presenceTime },
    { key: 'pending', header: 'Tempo pendente', align: 'center', cell: (week) => week.pendingTime, footer: resumo?.pendingTime },
    { key: 'excess', header: 'Excedente', align: 'center', cell: (week) => week.excessTime, footer: <span className="text-success">{resumo?.excessTime}</span> },
    {
      key: 'balance',
      header: 'Saldo ajuste diário',
      align: 'center',
      cell: (week) => <span className={`font-bold ${week.dailyAdjustBalance.startsWith('-') ? 'text-danger' : 'text-info'}`}>{week.dailyAdjustBalance}</span>,
      footer: <span className="text-info">{resumo?.dailyAdjustBalance}</span>,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Card as="section" padding="none" className="overflow-hidden" aria-labelledby="espelho-diario">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-line bg-surface-muted px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="rounded-control bg-brand-soft p-2 text-brand"><Calendar size={20} /></span>
            <h2 id="espelho-diario" className="text-lg font-bold tracking-tight text-ink">Espelho de Ponto Diário</h2>
          </div>
          <Field label="Mês de referência" name="mes" hideLabel className="w-full sm:w-52">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="cursor-pointer font-semibold" />
          </Field>
        </div>
        <div className="p-3 xl:p-0">
          <DataTable caption={`Espelho de ponto diário de ${month}`} columns={dayColumns} rows={historyData} rowKey={(day) => day.id} stackBelow="xl" compact empty={<p className="px-6 py-10 text-center text-sm text-ink-muted">Nenhum registro de ponto neste mês.</p>} />
        </div>
      </Card>

      {weeklyData && weeklyData.length > 0 && monthlySummary && (
        <Card as="section" padding="none" className="overflow-hidden">
          <CardHeader title="Totais Semanais" icon={<Layers size={20} />} />
          <div className="p-3 xl:p-0">
            <DataTable caption={`Totais semanais de ${month}`} columns={weekColumns} rows={weeklyData} rowKey={(week) => week.id} stackBelow="xl" compact />
          </div>
        </Card>
      )}

      {selectedDay && (
        <TimeNoteModal
          dateRef={formatarDataIso(selectedDay.date)}
          noteText={noteText} setNoteText={setNoteText}
          isSaving={isSaving} error={saveError} onClose={handleClose} onSave={handleSave}
        />
      )}
    </div>
  );
};

export default DashboardTimeMirror;
