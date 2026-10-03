import React, { useState } from 'react';
import { Calendar, MessageSquare, PlusCircle, Layers, AlertCircle } from 'lucide-react';
import { HistoryDay, MonthTotals, PeriodTotals, WeeklyTotal } from '../../services/pontoService';
import { ROTULO_DA_JUSTIFICATIVA, diaDaSemana, diaTemMarcacao, formatarDataIso, hojeDeBelem, podeJustificar, rotuloDoDia } from '../../utils/ponto';
import Badge, { type BadgeTone } from '../ui/Badge';
import Button from '../ui/Button';
import Card, { CardHeader } from '../ui/Card';
import DataTable, { type Column } from '../ui/DataTable';
import Field, { Input, Textarea } from '../ui/Field';
import Modal from '../ui/Modal';
import ErrorAlert from '../ErrorAlert';

const TOM_DO_STATUS: Record<HistoryDay['status'], BadgeTone> = {
  ok: 'success',
  atraso: 'warning',
  incompleto: 'warning',
  falta: 'danger',
  justificado: 'brand',
  fim_de_semana: 'neutral',
};

const TOM_DA_JUSTIFICATIVA: Record<NonNullable<HistoryDay['noteStatus']>, BadgeTone> = {
  pendente: 'warning',
  aprovada: 'success',
  recusada: 'danger',
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
    return { texto: 'O RH aprovou esta justificativa. O dia está abonado e o texto não pode mais ser alterado.', classe: 'border-success-line bg-success-soft text-success' };
  }
  if (day.noteStatus === 'recusada') {
    return { texto: `O RH recusou esta justificativa${day.noteReply ? `: ${day.noteReply}` : '.'} Você pode corrigir o texto e reenviar para uma nova análise.`, classe: 'border-danger-line bg-danger-soft text-danger' };
  }
  if (day.noteStatus === 'pendente') {
    return { texto: 'Aguardando a análise do RH. Enquanto isso você pode corrigir o texto.', classe: 'border-warning-line bg-warning-soft text-warning' };
  }
  return { texto: 'Sua justificativa será enviada ao RH, que vai aprová-la ou recusá-la. Você acompanha a resposta neste espelho.', classe: 'border-warning-line bg-warning-soft text-warning' };
};

const TimeNoteModal: React.FC<NoteModalProps> = ({ day, noteText, setNoteText, isSaving, error, onClose, onSave }) => {
  const aviso = avisoDoModal(day);
  const somenteLeitura = day.noteStatus === 'aprovada';
  return (
    <Modal
      title={day.noteStatus ? 'Justificativa' : 'Adicionar Justificativa'}
      description={`Ref: ${formatarDataIso(day.date)}`}
      size="sm"
      onClose={() => { if (!isSaving) onClose(); }}
      form={{ onSubmit: (evento) => { evento.preventDefault(); if (!somenteLeitura) onSave(); } }}
      footer={somenteLeitura ? undefined : (
        <Button type="submit" fullWidth size="lg" loading={isSaving} disabled={!noteText.trim()}>
          {isSaving ? 'Enviando...' : day.noteStatus === 'recusada' ? 'Reenviar Justificativa' : 'Enviar Justificativa'}
        </Button>
      )}
    >
      <div className="space-y-4">
        <p className={`flex gap-2 rounded-control border p-4 text-xs font-semibold ${aviso.classe}`}>
          <AlertCircle size={16} aria-hidden="true" className="shrink-0" />
          {aviso.texto}
        </p>
        <Field label="Texto da justificativa" name="justificativa">
          <Textarea
            data-autofocus
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            disabled={isSaving || somenteLeitura}
            maxLength={1000}
            rows={5}
            placeholder="Ex: Fui ao médico e tenho atestado..."
          />
        </Field>
        {error && <ErrorAlert message={error} />}
      </div>
    </Modal>
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

  const ajuste = (valor: string, tom: string) => <span className={`font-semibold ${valor !== '00:00' ? tom : 'text-ink-muted'}`}>{valor}</span>;

  // A nota do dia: o botão que abre a justificativa já enviada, ou o que abre uma nova em qualquer dia útil.
  // O nome acessível contém o texto visível (WCAG 2.5.3) e acrescenta a data, para distinguir um dia do outro.
  const acaoDaNota = (day: HistoryDay) => {
    const data = formatarDataIso(day.date);
    if (day.note) {
      return (
        <Button variant="secondary" size="sm" onClick={() => handleOpenNote(day)} className="h-auto max-w-[9rem] justify-start py-1.5 text-left" icon={<MessageSquare size={14} aria-hidden="true" className="shrink-0" />}>
          <span className="sr-only">Justificativa de {data}: </span>
          <span className="flex min-w-0 flex-col items-start gap-1">
            {day.noteStatus && <Badge tone={TOM_DA_JUSTIFICATIVA[day.noteStatus]}>{ROTULO_DA_JUSTIFICATIVA[day.noteStatus]}</Badge>}
            <span className="max-w-full truncate font-normal" title={day.note}>{day.note}</span>
          </span>
        </Button>
      );
    }
    if (!podeJustificar(day, hoje)) return null;
    return (
      <Button variant="ghost" size="sm" onClick={() => handleOpenNote(day)} className="h-auto max-w-[7rem] py-1.5 text-left" icon={<PlusCircle size={14} aria-hidden="true" className="shrink-0" />}>
        Adicionar nota<span className="sr-only"> em {data}</span>
      </Button>
    );
  };

  const dayColumns: Column<HistoryDay>[] = [
    {
      key: 'date',
      header: 'Data',
      cell: (day) => (
        <span className="whitespace-nowrap font-semibold text-ink">
          {formatarDataIso(day.date)}
          <span className="ml-2 text-xs font-semibold uppercase text-ink-muted xl:ml-0 xl:block">{diaDaSemana(day.date)}</span>
        </span>
      ),
    },
    { key: 'entry', header: 'Entrada', align: 'center', cell: (day) => day.entry },
    { key: 'lunchOut', header: 'Pausa', align: 'center', cell: (day) => day.lunchOut },
    { key: 'lunchIn', header: 'Retorno', align: 'center', cell: (day) => day.lunchIn },
    { key: 'exit', header: 'Saída', align: 'center', cell: (day) => day.exit },
    { key: 'totalHours', header: 'Horas', align: 'center', cell: (day) => <span className="font-semibold text-ink">{day.totalHours}</span> },
    { key: 'delay', header: 'Atraso', align: 'center', cell: (day) => ajuste(day.delay, 'text-warning') },
    { key: 'negativeAdjust', header: 'Ajuste negativo', align: 'center', cell: (day) => ajuste(day.negativeAdjust, 'text-danger') },
    { key: 'positiveAdjust', header: 'Ajuste positivo', align: 'center', cell: (day) => ajuste(day.positiveAdjust, 'text-info') },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      cell: (day) => <Badge tone={day.open && day.status === 'ok' ? 'neutral' : TOM_DO_STATUS[day.status]}>{rotuloDoDia(day)}</Badge>,
    },
    { key: 'note', header: 'Justificativa', align: 'right', semRotuloNoCartao: true, cell: acaoDaNota },
  ];

  const resumo: PeriodTotals | undefined = monthTotals?.monthlySummary;
  const tomDoValor = (valor: string, tom: string) => <span className={valor !== '00:00' ? `font-semibold ${tom}` : undefined}>{valor}</span>;
  const weekColumns: Column<WeeklyTotal>[] = [
    { key: 'week', header: 'Semana', cell: (week) => <span className="font-semibold text-ink">{week.weekLabel}</span>, footer: 'Total Mensal' },
    { key: 'limit', header: 'Carga prevista', align: 'center', cell: (week) => week.workloadLimit, footer: resumo?.workloadLimit },
    { key: 'done', header: 'Horas trabalhadas', align: 'center', cell: (week) => <span className="font-semibold text-ink">{week.workloadDone}</span>, footer: resumo?.workloadDone },
    { key: 'pending', header: 'Pendente', align: 'center', cell: (week) => tomDoValor(week.pendingTime, 'text-danger'), footer: resumo?.pendingTime },
    { key: 'excess', header: 'Excedente', align: 'center', cell: (week) => tomDoValor(week.excessTime, 'text-info'), footer: <span className="text-success">{resumo?.excessTime}</span> },
    { key: 'delay', header: 'Atrasos', align: 'center', cell: (week) => tomDoValor(week.delayTime, 'text-warning'), footer: resumo?.delayTime },
    { key: 'absences', header: 'Faltas', align: 'center', cell: (week) => <span className={week.absences > 0 ? 'font-semibold text-danger' : undefined}>{week.absences}</span>, footer: resumo?.absences },
    { key: 'incomplete', header: 'Incompletos', align: 'center', cell: (week) => week.incompleteDays, footer: resumo?.incompleteDays },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Card as="section" padding="none" className="overflow-hidden" aria-labelledby="espelho-diario">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-line bg-surface-muted px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="rounded-control bg-brand-soft p-2 text-brand"><Calendar size={20} /></span>
            <h2 id="espelho-diario" className="text-lg font-bold tracking-tight text-ink">Espelho de Ponto Diário</h2>
          </div>
          <Field label="Mês do espelho de ponto" name="mes" hideLabel className="w-full sm:w-52">
            <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="cursor-pointer font-semibold" />
          </Field>
        </div>

        {mesSemMarcacoes && (
          <p role="status" className="border-b border-line bg-surface-muted px-5 py-4 text-sm font-semibold text-ink-muted sm:px-6">
            Nenhuma marcação registrada neste mês. Se você trabalhou em algum dia, use "Adicionar nota" na linha do dia para avisar o RH.
          </p>
        )}

        <div className="p-3 xl:p-0">
          <DataTable caption={`Espelho de ponto diário de ${month}`} columns={dayColumns} rows={historyData} rowKey={(day) => day.id} stackBelow="xl" compact empty={<p className="px-6 py-10 text-center text-sm text-ink-muted">Nenhum dia neste mês.</p>} />
        </div>
      </Card>

      {monthTotals && monthTotals.totals.length > 0 && (
        <Card as="section" padding="none" className="overflow-hidden">
          <CardHeader
            title="Totais Semanais"
            icon={<Layers size={20} />}
            actions={(
              <p className="text-xs font-semibold text-ink-muted">
                Jornada: {monthTotals.workSchedule.entry} às {monthTotals.workSchedule.exit}, {monthTotals.workSchedule.weeklyHours}h semanais, tolerância de {monthTotals.workSchedule.toleranceMinutes} min
              </p>
            )}
          />
          <div className="p-3 xl:p-0">
            <DataTable caption={`Totais semanais de ${month}`} columns={weekColumns} rows={monthTotals.totals} rowKey={(week) => week.id} stackBelow="xl" compact />
          </div>
        </Card>
      )}

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
