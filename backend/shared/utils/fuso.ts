// Data e hora no fuso de uma empresa. O banco guarda o instante (TIMESTAMP) e o servidor pode rodar em
// qualquer fuso; tudo que o usuário vê ou que define "hoje" e "mês" passa por aqui, com o fuso IANA
// da empresa (empresas.fuso). Instantes circulam como segundos Unix (UNIX_TIMESTAMP / FROM_UNIXTIME
// no SQL), que não dependem do fuso da sessão do MySQL nem do fuso do processo Node.
export const FUSO_PADRAO = 'America/Belem';

// Relógio do servidor em ms, trocável nos testes para fixar "agora" perto da virada do dia.
export const relogio = { agora: (): number => Date.now() };

export const agoraEmSegundos = (): number => Math.floor(relogio.agora() / 1000);

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export interface Intervalo {
    inicio: number;
    fim: number;
}

export interface Fuso {
    zona: string;
    // 'YYYY-MM-DD' do dia em que o instante cai.
    diaLocal: (segundos: number) => string;
    // 'HH:MM:SS'.
    horaLocal: (segundos: number) => string;
    // 'YYYY-MM' do instante.
    mesLocal: (segundos: number) => string;
    // [inicio, fim) em segundos Unix do dia 'YYYY-MM-DD'.
    limitesDoDia: (dia: string) => Intervalo;
    // [inicio, fim) em segundos Unix do mês 'YYYY-MM'.
    limitesDoMes: (mes: string) => Intervalo;
}

const paraMs = (segundos: number): number => segundos * 1000;

const construir = (zona: string): Fuso => {
    // Zona desconhecida lança RangeError aqui, ao criar o formatador, e não no meio de uma consulta.
    const formatadorDia = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' });
    const formatadorHora = new Intl.DateTimeFormat('pt-BR', { timeZone: zona, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const formatadorPartes = new Intl.DateTimeFormat('en-US', {
        timeZone: zona, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
    });

    // Diferença, em segundos, entre o relógio da zona e o UTC no instante dado (negativa a oeste).
    const deslocamento = (segundos: number): number => {
        const p = Object.fromEntries(formatadorPartes.formatToParts(paraMs(segundos)).map((x) => [x.type, Number(x.value)]));
        return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) / 1000 - segundos;
    };

    // Instante em que o relógio da zona marca meia-noite do dia civil (ano, mês 1-12, dia).
    // Duas passadas absorvem uma eventual mudança de offset no próprio dia.
    const meiaNoite = (ano: number, mes: number, dia: number): number => {
        const relogioComoUtc = Date.UTC(ano, mes - 1, dia) / 1000;
        const aproximado = relogioComoUtc - deslocamento(relogioComoUtc);
        return relogioComoUtc - deslocamento(aproximado);
    };

    const diaLocal = (segundos: number): string => formatadorDia.format(paraMs(segundos));

    return {
        zona,
        diaLocal,
        horaLocal: (segundos) => formatadorHora.format(paraMs(segundos)),
        mesLocal: (segundos) => diaLocal(segundos).slice(0, 7),
        limitesDoDia: (dia) => {
            const [, ano, mes, d] = dia.match(DIA)!.map(Number);
            return { inicio: meiaNoite(ano, mes, d), fim: meiaNoite(ano, mes, d + 1) };
        },
        limitesDoMes: (mes) => {
            const [, ano, m] = mes.match(MES)!.map(Number);
            return { inicio: meiaNoite(ano, m, 1), fim: meiaNoite(ano, m + 1, 1) };
        },
    };
};

const cache = new Map<string, Fuso>();

// O fuso IANA ('America/Manaus'). Os formatadores são caros de criar, então cada zona é montada uma vez.
export const criarFuso = (zona: string = FUSO_PADRAO): Fuso => {
    let fuso = cache.get(zona);
    if (!fuso) {
        fuso = construir(zona);
        cache.set(zona, fuso);
    }
    return fuso;
};

export const mesValido = (mes: unknown): mes is string => typeof mes === 'string' && MES.test(mes);
