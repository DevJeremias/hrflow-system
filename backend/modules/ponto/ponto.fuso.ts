// Data e hora do ponto no fuso da empresa. O banco guarda o instante (TIMESTAMP) e o servidor
// pode rodar em qualquer fuso; tudo que o colaborador vê ou que define "hoje" e "mês" passa por aqui.
// Instantes circulam como segundos Unix (UNIX_TIMESTAMP / FROM_UNIXTIME no SQL), que não dependem
// do fuso da sessão do MySQL nem do fuso do processo Node.
// O relógio e o dia de Belém vivem em shared/utils/relogio.ts, para quem não pode importar o ponto.
import { FUSO, relogio, diaLocal } from '../../shared/utils/relogio.ts';

export { FUSO, relogio, diaLocal };

const formatadorHora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const formatadorPartes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
});

const paraMs = (segundos: number): number => segundos * 1000;

// 'HH:MM:SS' em Belém.
export const horaLocal = (segundos: number): string => formatadorHora.format(paraMs(segundos));

// Diferença, em segundos, entre o relógio de Belém e o UTC no instante dado (negativa a oeste).
const deslocamento = (segundos: number): number => {
    const p = Object.fromEntries(formatadorPartes.formatToParts(paraMs(segundos)).map((x) => [x.type, Number(x.value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) / 1000 - segundos;
};

// Instante em que o relógio de Belém marca meia-noite do dia civil (ano, mês 1-12, dia).
// Duas passadas absorvem uma eventual mudança de offset no próprio dia.
const meiaNoite = (ano: number, mes: number, dia: number): number => {
    const relogioComoUtc = Date.UTC(ano, mes - 1, dia) / 1000;
    const aproximado = relogioComoUtc - deslocamento(relogioComoUtc);
    return relogioComoUtc - deslocamento(aproximado);
};

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export interface Intervalo {
    inicio: number;
    fim: number;
}

// [inicio, fim) em segundos Unix do dia 'YYYY-MM-DD' de Belém.
export const limitesDoDia = (dia: string): Intervalo => {
    const [, ano, mes, d] = dia.match(DIA)!.map(Number);
    const inicio = meiaNoite(ano, mes, d);
    return { inicio, fim: meiaNoite(ano, mes, d + 1) };
};

// [inicio, fim) em segundos Unix do mês 'YYYY-MM' de Belém.
export const limitesDoMes = (mes: string): Intervalo => {
    const [, ano, m] = mes.match(MES)!.map(Number);
    return { inicio: meiaNoite(ano, m, 1), fim: meiaNoite(ano, m + 1, 1) };
};

export const mesValido = (mes: unknown): mes is string => typeof mes === 'string' && MES.test(mes);

// 'YYYY-MM' de Belém no instante.
export const mesLocal = (segundos: number): string => diaLocal(segundos).slice(0, 7);
