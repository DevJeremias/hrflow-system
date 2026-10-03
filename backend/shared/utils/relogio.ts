// O relógio do servidor e o dia civil de Belém, que define "hoje" para o ponto, a folha e as vigências
// do histórico contratual. Instantes circulam como segundos Unix.
export const FUSO = 'America/Belem';

// Relógio do servidor em ms, trocável nos testes para fixar "agora" perto da virada do dia em Belém.
export const relogio = { agora: (): number => Date.now() };

const formatadorDia = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
});

// 'YYYY-MM-DD' do dia, em Belém, em que o instante cai.
export const diaLocal = (segundos: number): string => formatadorDia.format(segundos * 1000);

// 'YYYY-MM-DD' de hoje em Belém.
export const hoje = (): string => diaLocal(Math.floor(relogio.agora() / 1000));
