// Competência: o mês de referência da folha, 'AAAA-MM' na API e por extenso em pt-BR na tela.

// O mês corrente em Belém, o fuso do servidor: perto da virada do mês o navegador pode estar
// noutro mês e a API recusaria uma competência que ainda não começou.
export const mesAtualEmBelem = (): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Belem',
  year: 'numeric',
  month: '2-digit'
}).format(new Date()).slice(0, 7);

// 'AAAA-MM' como "outubro de 2026". Fica em minúsculas de propósito: o "de" não pode virar "De" por CSS.
export const rotuloDaCompetencia = (competencia: string): string => {
  const [ano, mes] = competencia.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(ano, mes - 1, 1)));
};

// Instante ISO da API como "02/10/2026 às 14:30", no horário de Belém.
export const formatarMomento = (iso: string): string => {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Belem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).map((parte) => [parte.type, parte.value]));
  return `${partes.day}/${partes.month}/${partes.year} às ${partes.hour}:${partes.minute}`;
};
