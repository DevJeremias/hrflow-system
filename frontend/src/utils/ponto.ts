import { FUSO_PADRAO } from './fuso.ts';
import type { DayStatus, HistoryDay, JustificationStatus, PointRecord } from '../services/pontoService';

export type TipoPonto = 'Entrada' | 'Pausa Almoço' | 'Retorno Almoço' | 'Saída';

const PROXIMOS: Record<TipoPonto, readonly TipoPonto[]> = {
  'Entrada': ['Pausa Almoço', 'Saída'],
  'Pausa Almoço': ['Retorno Almoço'],
  'Retorno Almoço': ['Saída'],
  'Saída': [],
};

export const proximosTiposDePonto = (registros: PointRecord[]): readonly TipoPonto[] => {
  const ultimoTipo = registros.at(-1)?.type as TipoPonto | undefined;
  return ultimoTipo ? PROXIMOS[ultimoTipo] ?? [] : ['Entrada'];
};

// A hora e a data, no relógio do fuso da empresa (ver utils/fuso.ts).
export const formatarHoraNoFuso = (data: Date, fuso: string = FUSO_PADRAO): string => new Intl.DateTimeFormat('pt-BR', {
  timeZone: fuso, hour: '2-digit', minute: '2-digit', second: '2-digit',
}).format(data);

export const formatarDataNoFuso = (data: Date, fuso: string = FUSO_PADRAO): string => new Intl.DateTimeFormat('pt-BR', {
  timeZone: fuso, weekday: 'long', day: 'numeric', month: 'long',
}).format(data);

// 'AAAA-MM-DD' (o dia que a API devolve) como 'dd/mm/aaaa'.
export const formatarDataIso = (data: string): string => data.split('-').reverse().join('/');

// 'HH:MM:SS' como 'HH:MM'.
export const formatarHoraSemSegundos = (hora: string): string => hora.slice(0, 5);

// 'AAAA-MM-DD' de hoje no fuso da empresa, o mesmo dia que a API usa para recusar justificativa futura.
export const hojeNoFuso = (fuso: string = FUSO_PADRAO, agora: Date = new Date()): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(agora);

// Dia da semana abreviado ('qui.') de um 'AAAA-MM-DD'.
export const diaDaSemana = (data: string): string => new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC', weekday: 'short',
}).format(new Date(`${data}T00:00:00Z`));

export const ROTULO_DO_STATUS: Record<DayStatus, string> = {
  ok: 'OK',
  atraso: 'Atraso',
  incompleto: 'Incompleto',
  falta: 'Falta',
  justificado: 'Justificado',
  fim_de_semana: 'Fim de semana',
};

// Rótulo do status do dia; o dia ainda sem apuração (futuro, hoje sem saída, antes da admissão) não é "OK".
export const rotuloDoDia = (dia: Pick<HistoryDay, 'status' | 'open'>): string => (
  dia.open && dia.status === 'ok' ? '—' : ROTULO_DO_STATUS[dia.status]
);

export const ROTULO_DA_JUSTIFICATIVA: Record<JustificationStatus, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
};

// Qualquer dia útil que já começou pode ser justificado, tenha marcação ou não; o dia que já tem
// justificativa abre sempre, para o colaborador ler a resposta do RH.
export const podeJustificar = (dia: Pick<HistoryDay, 'date' | 'status' | 'note'>, hoje: string): boolean => (
  dia.note !== '' || (dia.status !== 'fim_de_semana' && dia.date <= hoje)
);

export const diaTemMarcacao = (dia: Pick<HistoryDay, 'entry' | 'lunchOut' | 'lunchIn' | 'exit'>): boolean => (
  [dia.entry, dia.lunchOut, dia.lunchIn, dia.exit].some((horario) => horario !== '--:--')
);
