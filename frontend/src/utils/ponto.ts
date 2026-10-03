import type { PointRecord } from '../services/pontoService';

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

export const formatarHoraDeBelem = (data: Date): string => new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Belem', hour: '2-digit', minute: '2-digit', second: '2-digit',
}).format(data);

export const formatarDataDeBelem = (data: Date): string => new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Belem', weekday: 'long', day: 'numeric', month: 'long',
}).format(data);

// 'AAAA-MM-DD' (o dia que a API devolve) como 'dd/mm/aaaa'.
export const formatarDataIso = (data: string): string => data.split('-').reverse().join('/');

// 'HH:MM:SS' como 'HH:MM'.
export const formatarHoraSemSegundos = (hora: string): string => hora.slice(0, 5);
