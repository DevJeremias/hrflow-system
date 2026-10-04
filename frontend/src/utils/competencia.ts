// Competência: o mês de referência da folha, 'AAAA-MM' na API e por extenso em pt-BR na tela.

import { FUSO_PADRAO } from './fuso.ts';

// O mês corrente no fuso da empresa, o que a API usa: perto da virada do mês o navegador pode estar
// noutro mês e a API recusaria uma competência que ainda não começou.
export const mesAtualNoFuso = (fuso: string = FUSO_PADRAO): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: fuso,
  year: 'numeric',
  month: '2-digit'
}).format(new Date()).slice(0, 7);

// 'AAAA-MM' como "outubro de 2026". Fica em minúsculas de propósito: o "de" não pode virar "De" por CSS.
export const rotuloDaCompetencia = (competencia: string): string => {
  const [ano, mes] = competencia.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(ano, mes - 1, 1)));
};

// Instante ISO da API como "02/10/2026 às 14:30", no horário do fuso da empresa.
export const formatarMomento = (iso: string, fuso: string = FUSO_PADRAO): string => {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).map((parte) => [parte.type, parte.value]));
  return `${partes.day}/${partes.month}/${partes.year} às ${partes.hour}:${partes.minute}`;
};

// O mês 'AAAA-MM' de `n` meses antes de `mes` (n negativo avança).
export const mesesAntes = (mes: string, n: number): string => {
  const [ano, m] = mes.split('-').map(Number);
  const indice = ano * 12 + (m - 1) - n;
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`;
};

// 'AAAA-MM' como "mar", o nome curto do mês para o eixo de um gráfico.
export const nomeCurtoDoMes = (mes: string): string => {
  const [ano, m] = mes.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(ano, m - 1, 1))).replace('.', '');
};
