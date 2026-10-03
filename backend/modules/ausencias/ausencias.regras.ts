// Regras de férias e afastamentos que não dependem do banco: tipos, período aquisitivo, saldo e
// duração. Todo dia é texto 'AAAA-MM-DD' (ordena como data) e as contas passam por UTC, nunca pelo
// fuso do processo. O "hoje" chega de fora: o relógio do ponto decide, e os testes o fixam.

export const TIPOS = ['Férias', 'Licença Médica', 'Licença Maternidade', 'Licença Paternidade', 'Acidente de Trabalho', 'Outros'] as const;

export type TipoDeAusencia = typeof TIPOS[number];

export const STATUS = ['Pendente', 'Aprovada', 'Recusada'] as const;

export type StatusDeAusencia = typeof STATUS[number];

// Os tipos que tiram o colaborador do trabalho e mudam a situação dele para Afastado. "Outros" é
// um pedido avulso (um abono, por exemplo) e não muda a situação.
export const TIPOS_DE_AFASTAMENTO: readonly TipoDeAusencia[] = ['Licença Médica', 'Licença Maternidade', 'Licença Paternidade', 'Acidente de Trabalho'];

// O atestado e o boletim de ocorrência são a prova da licença: sem eles o RH não tem o que aprovar.
export const TIPOS_COM_ANEXO_OBRIGATORIO: readonly TipoDeAusencia[] = ['Licença Médica', 'Acidente de Trabalho'];

// CLT, arts. 129 e 130: cada 12 meses de trabalho dão direito a 30 dias corridos de férias, que o
// colaborador pode dividir em até três períodos de no mínimo 5 dias.
export const DIAS_POR_PERIODO_AQUISITIVO = 30;
export const DURACAO_MINIMA_DAS_FERIAS = 5;
export const DURACAO_MAXIMA_DA_LICENCA = 365;

const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;

const emMs = (dia: string): number => Date.parse(`${dia}T00:00:00Z`);

const paraDia = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

// Quantos dias corridos o período tem, contando o primeiro e o último.
export const diasCorridos = (inicio: string, fim: string): number => Math.round((emMs(fim) - emMs(inicio)) / UM_DIA_EM_MS) + 1;

export const somarDias = (dia: string, dias: number): string => paraDia(emMs(dia) + dias * UM_DIA_EM_MS);

// O mesmo dia e mês, `anos` depois. 29 de fevereiro cai em 28 nos anos não bissextos.
export const somarAnos = (dia: string, anos: number): string => {
    const [ano, mes, d] = dia.split('-').map(Number);
    const data = new Date(Date.UTC(ano + anos, mes - 1, d));
    if (data.getUTCMonth() !== mes - 1) data.setUTCDate(0);
    return paraDia(data.getTime());
};

// Quantos dias do período [inicio, fim] caem em [de, ate].
export const diasNoIntervalo = (inicio: string, fim: string, de: string, ate: string): number => {
    const primeiro = inicio > de ? inicio : de;
    const ultimo = fim < ate ? fim : ate;
    return primeiro > ultimo ? 0 : diasCorridos(primeiro, ultimo);
};

export interface PedidoDeAusencia {
    tipo: TipoDeAusencia;
    inicio: string;
    fim: string;
    anexado: boolean;
}

// Por que o pedido não vale, ou null. A ordem das datas é conferida antes, no schema; aqui estão as
// regras que dependem do tipo e do dia de hoje.
export const motivoDeRecusaDoPedido = ({ tipo, inicio, fim, anexado }: PedidoDeAusencia, hoje: string): string | null => {
    const dias = diasCorridos(inicio, fim);
    if (tipo === 'Férias') {
        if (inicio < hoje) return 'As férias precisam começar hoje ou depois.';
        if (dias < DURACAO_MINIMA_DAS_FERIAS) return `Cada período de férias tem no mínimo ${DURACAO_MINIMA_DAS_FERIAS} dias.`;
        if (dias > DIAS_POR_PERIODO_AQUISITIVO) return `Cada período de férias tem no máximo ${DIAS_POR_PERIODO_AQUISITIVO} dias.`;
    } else if (dias > DURACAO_MAXIMA_DA_LICENCA) {
        return `O afastamento pode ter no máximo ${DURACAO_MAXIMA_DA_LICENCA} dias.`;
    }
    if (TIPOS_COM_ANEXO_OBRIGATORIO.includes(tipo) && !anexado) {
        return tipo === 'Licença Médica' ? 'Anexe o atestado médico à solicitação.' : 'Anexe o boletim de ocorrência ou o comunicado do acidente à solicitação.';
    }
    return null;
};

export const sobrepoe = (a: { inicio: string; fim: string }, b: { inicio: string; fim: string }): boolean => a.inicio <= b.fim && b.inicio <= a.fim;

export interface PeriodoDeFerias {
    inicio: string;
    fim: string;
}

// O que o colaborador já pediu de férias: os dias das aprovadas e os das ainda em análise.
export interface FeriasPedidas {
    aprovadas: number;
    emAnalise: number;
}

export interface SaldoDeFerias {
    admissao: string | null;
    // O período aquisitivo em curso (os 12 meses que ainda estão sendo cumpridos); null sem admissão.
    periodoAquisitivo: PeriodoDeFerias | null;
    periodosCompletos: number;
    diasAdquiridos: number;
    diasAprovados: number;
    diasEmAnalise: number;
    saldo: number;
    // Até quando o período mais antigo com dias a gozar precisa ser gozado (12 meses depois de
    // completado, art. 134); null sem saldo. Passado esse dia, as férias estão vencidas.
    prazoParaGozo: string | null;
    vencido: boolean;
}

// Quantos períodos aquisitivos o colaborador completou até `em`: o direito nasce no aniversário da admissão.
export const periodosCompletos = (admissao: string, em: string): number => {
    let completos = 0;
    while (somarAnos(admissao, completos + 1) <= em) completos += 1;
    return completos;
};

// O saldo de férias em `em`: 30 dias por período aquisitivo completado, menos o que já foi pedido.
// Os dias pedidos consomem os períodos mais antigos primeiro, e o prazo para gozo é o do mais antigo
// que sobrar. Sem data de admissão não há como contar, e o saldo é zero.
export const calcularSaldo = (admissao: string | null, em: string, pedidas: FeriasPedidas): SaldoDeFerias => {
    if (admissao === null) {
        return { admissao, periodoAquisitivo: null, periodosCompletos: 0, diasAdquiridos: 0, diasAprovados: pedidas.aprovadas, diasEmAnalise: pedidas.emAnalise, saldo: 0, prazoParaGozo: null, vencido: false };
    }
    const completos = periodosCompletos(admissao, em);
    const adquiridos = completos * DIAS_POR_PERIODO_AQUISITIVO;
    const consumidos = pedidas.aprovadas + pedidas.emAnalise;
    const saldo = Math.max(0, adquiridos - consumidos);
    const periodoMaisAntigoComSaldo = Math.floor(consumidos / DIAS_POR_PERIODO_AQUISITIVO) + 1;
    const prazoParaGozo = saldo > 0 ? somarDias(somarAnos(admissao, periodoMaisAntigoComSaldo + 1), -1) : null;
    return {
        admissao,
        periodoAquisitivo: { inicio: somarAnos(admissao, completos), fim: somarDias(somarAnos(admissao, completos + 1), -1) },
        periodosCompletos: completos,
        diasAdquiridos: adquiridos,
        diasAprovados: pedidas.aprovadas,
        diasEmAnalise: pedidas.emAnalise,
        saldo,
        prazoParaGozo,
        vencido: prazoParaGozo !== null && prazoParaGozo < em,
    };
};

export type SituacaoPelaAusencia = 'Férias' | 'Afastado';

// A situação que o tipo de uma ausência aprovada dá ao colaborador, ou null quando não muda nada.
export const situacaoDoTipo = (tipo: TipoDeAusencia): SituacaoPelaAusencia | null => {
    if (tipo === 'Férias') return 'Férias';
    return TIPOS_DE_AFASTAMENTO.includes(tipo) ? 'Afastado' : null;
};
