// Regras do registro de ponto que não dependem do banco: sequência das marcações e coordenadas.
export const TIPOS = ['Entrada', 'Pausa Almoço', 'Retorno Almoço', 'Saída'] as const;

export type TipoRegistro = typeof TIPOS[number];

// Cada validação devolve { dados } quando aceita a entrada e { erro } com a mensagem para o
// usuário quando recusa; 'erro' in resultado separa os dois casos.
export type Validacao<T> = { dados: T } | { erro: string };

export interface Coordenadas {
    latitude: number | null;
    longitude: number | null;
}

// Tipos aceitos depois de cada marcação do dia. A pausa de almoço é opcional (Entrada pode
// ir direto para Saída), mas uma vez iniciada exige o retorno. Saída encerra o dia.
const PROXIMOS: Record<TipoRegistro, readonly TipoRegistro[]> = {
    'Entrada': ['Pausa Almoço', 'Saída'],
    'Pausa Almoço': ['Retorno Almoço'],
    'Retorno Almoço': ['Saída'],
    'Saída': [],
};

export const proximosPermitidos = (ultimoTipo: TipoRegistro | null): readonly TipoRegistro[] => (
    ultimoTipo ? PROXIMOS[ultimoTipo] : ['Entrada']
);

export const validarTipo = (tipo: unknown): Validacao<TipoRegistro> => {
    if (typeof tipo !== 'string' || !(TIPOS as readonly string[]).includes(tipo)) {
        return { erro: `Tipo de registro inválido. Use um destes: ${TIPOS.join(', ')}.` };
    }
    return { dados: tipo as TipoRegistro };
};

export const LIMITE_OBSERVACAO = 255;

export const validarObservacao = (observacao: unknown): Validacao<string> => {
    if (observacao === undefined || observacao === null) return { dados: '' };
    if (typeof observacao !== 'string') return { erro: 'A observação deve ser um texto.' };
    if (observacao.length > LIMITE_OBSERVACAO) {
        return { erro: `A observação deve ter no máximo ${LIMITE_OBSERVACAO} caracteres.` };
    }
    return { dados: observacao };
};

const ehNumeroFinito = (valor: unknown): valor is number => typeof valor === 'number' && Number.isFinite(valor);

// Coordenadas são opcionais, mas vêm em par: latitude em [-90, 90] e longitude em [-180, 180],
// como números JSON (texto como "-1.45" é recusado para não aceitar lixo como "1e3" ou " ").
export const validarCoordenadas = ({ latitude, longitude }: { latitude?: unknown; longitude?: unknown }): Validacao<Coordenadas> => {
    const semLatitude = latitude === undefined || latitude === null;
    const semLongitude = longitude === undefined || longitude === null;
    if (semLatitude && semLongitude) return { dados: { latitude: null, longitude: null } };
    if (semLatitude || semLongitude) {
        return { erro: 'Informe latitude e longitude juntas, ou nenhuma das duas.' };
    }
    if (!ehNumeroFinito(latitude) || !ehNumeroFinito(longitude)) {
        return { erro: 'Latitude e longitude devem ser números.' };
    }
    if (latitude < -90 || latitude > 90) return { erro: 'Latitude fora do intervalo válido (-90 a 90).' };
    if (longitude < -180 || longitude > 180) return { erro: 'Longitude fora do intervalo válido (-180 a 180).' };
    return { dados: { latitude, longitude } };
};

// ---------------------------------------------------------------------------------------------
// Apuração: o que cada dia vale diante da jornada do colaborador. Funções puras: o serviço traz as
// marcações e a jornada do banco e o "hoje" do relógio, e aqui só se calcula. Todo horário é em
// minutos desde a meia-noite de Belém; todo dia é 'AAAA-MM-DD'.
// ---------------------------------------------------------------------------------------------

export interface Marcacao {
    tipo: TipoRegistro;
    minuto: number;
}

// Jornada de segunda a sexta: `cargaDiariaMin` é a carga semanal dividida pelos cinco dias úteis.
// O atraso só conta quando a entrada passa de `entradaMin + toleranciaMin`; o saldo do dia só
// vira pendência ou excedente quando passa da mesma tolerância.
export interface Jornada {
    entradaMin: number;
    toleranciaMin: number;
    cargaDiariaMin: number;
}

export type StatusDoDia = 'ok' | 'atraso' | 'incompleto' | 'falta' | 'justificado' | 'fim_de_semana';

export interface ApuracaoDoDia {
    status: 'ok' | 'atraso' | 'incompleto' | 'falta';
    // null quando o dia não tem marcações suficientes para somar horas.
    trabalhadoMin: number | null;
    atrasoMin: number;
    // Quanto faltou e quanto passou da carga do dia, já descontada a tolerância.
    pendenteMin: number;
    excedenteMin: number;
}

export interface Marcas {
    entrada: number | null;
    pausa: number | null;
    retorno: number | null;
    saida: number | null;
}

const DIAS_UTEIS_DA_SEMANA = 5;
const MINUTOS_POR_HORA = 60;

export const cargaDiariaMin = (cargaSemanalHoras: number): number => Math.round((cargaSemanalHoras * MINUTOS_POR_HORA) / DIAS_UTEIS_DA_SEMANA);

// Uma marca por tipo: a primeira Entrada e a primeira Pausa, o último Retorno e a última Saída,
// que é como o dia é lido mesmo que o banco guarde marcações repetidas.
export const marcasDoDia = (marcacoes: readonly Marcacao[]): Marcas => {
    const ordenadas = [...marcacoes].sort((a, b) => a.minuto - b.minuto);
    const primeira = (tipo: TipoRegistro) => ordenadas.find((m) => m.tipo === tipo)?.minuto ?? null;
    const ultima = (tipo: TipoRegistro) => ordenadas.filter((m) => m.tipo === tipo).at(-1)?.minuto ?? null;
    return { entrada: primeira('Entrada'), pausa: primeira('Pausa Almoço'), retorno: ultima('Retorno Almoço'), saida: ultima('Saída') };
};

// Horas do dia fechado: (pausa - entrada) + (saída - retorno), ou saída - entrada quando não houve
// almoço. Null quando o dia não fecha (sem entrada, sem saída, pausa sem retorno ou ordem inválida).
export const minutosTrabalhados = ({ entrada, pausa, retorno, saida }: Marcas): number | null => {
    if (entrada === null || saida === null) return null;
    if (pausa === null && retorno === null) return saida > entrada ? saida - entrada : null;
    if (pausa === null || retorno === null) return null;
    if (!(entrada <= pausa && pausa <= retorno && retorno <= saida) || saida === entrada) return null;
    return (pausa - entrada) + (saida - retorno);
};

// `encerrado` é falso só para o dia de hoje: ele ainda pode receber marcações, então a falta de
// saída não o torna incompleto nem a falta de marcações o torna falta.
export const apurarDia = (marcacoes: readonly Marcacao[], jornada: Jornada, { encerrado = true } = {}): ApuracaoDoDia => {
    const marcas = marcasDoDia(marcacoes);
    const trabalhadoMin = minutosTrabalhados(marcas);
    const atrasoBruto = marcas.entrada === null ? 0 : marcas.entrada - jornada.entradaMin;
    const atrasoMin = atrasoBruto > jornada.toleranciaMin ? atrasoBruto : 0;

    if (marcacoes.length === 0) {
        return encerrado
            ? { status: 'falta', trabalhadoMin: null, atrasoMin: 0, pendenteMin: jornada.cargaDiariaMin, excedenteMin: 0 }
            : { status: 'ok', trabalhadoMin: null, atrasoMin: 0, pendenteMin: 0, excedenteMin: 0 };
    }

    if (trabalhadoMin === null) {
        return { status: encerrado ? 'incompleto' : atrasoMin > 0 ? 'atraso' : 'ok', trabalhadoMin: null, atrasoMin, pendenteMin: 0, excedenteMin: 0 };
    }

    const saldo = trabalhadoMin - jornada.cargaDiariaMin;
    const fora = Math.abs(saldo) > jornada.toleranciaMin;
    return {
        status: atrasoMin > 0 ? 'atraso' : 'ok',
        trabalhadoMin,
        atrasoMin,
        pendenteMin: fora && saldo < 0 ? -saldo : 0,
        excedenteMin: fora && saldo > 0 ? saldo : 0,
    };
};

export type DecisaoDaJustificativa = 'pendente' | 'aprovada' | 'recusada';

export interface DiaParaApurar {
    data: string;
    marcacoes: readonly Marcacao[];
    justificativa: DecisaoDaJustificativa | null;
}

export interface DiaApurado extends ApuracaoDoDia {
    data: string;
    marcas: Marcas;
    // Sobrescreve o status do cálculo: fim de semana e justificativa aprovada.
    statusFinal: StatusDoDia;
    // O dia ainda não foi apurado: está no futuro, é hoje sem saída ou antecede a admissão.
    aberto: boolean;
    // Carga esperada do dia: zero em fim de semana e antes da admissão.
    previstoMin: number;
}

export const ehFimDeSemana = (data: string): boolean => {
    const dia = new Date(`${data}T00:00:00Z`).getUTCDay();
    return dia === 0 || dia === 6;
};

// Apura cada dia do mês. `hoje` e `admissao` ('AAAA-MM-DD' ou null) dizem de onde a apuração vale:
// dias futuros e anteriores à admissão ficam abertos e sem pendência.
export const apurarMes = (dias: readonly DiaParaApurar[], jornada: Jornada, { hoje, admissao }: { hoje: string; admissao: string | null }): DiaApurado[] => (
    dias.map(({ data, marcacoes, justificativa }) => {
        const marcas = marcasDoDia(marcacoes);
        const vazio = { trabalhadoMin: null, atrasoMin: 0, pendenteMin: 0, excedenteMin: 0 };
        const fimDeSemana = ehFimDeSemana(data);
        const foraDoPeriodo = data > hoje || (admissao !== null && data < admissao);

        let dia: DiaApurado;
        if (fimDeSemana) {
            const trabalhadoMin = minutosTrabalhados(marcas);
            dia = { data, marcas, status: 'ok', ...vazio, trabalhadoMin, excedenteMin: trabalhadoMin ?? 0, statusFinal: 'fim_de_semana', aberto: false, previstoMin: 0 };
        } else if (foraDoPeriodo) {
            dia = { data, marcas, status: 'ok', ...vazio, statusFinal: 'ok', aberto: true, previstoMin: admissao !== null && data < admissao ? 0 : jornada.cargaDiariaMin };
        } else {
            const apuracao = apurarDia(marcacoes, jornada, { encerrado: data < hoje });
            dia = { data, marcas, ...apuracao, statusFinal: apuracao.status, aberto: data === hoje && marcas.saida === null, previstoMin: jornada.cargaDiariaMin };
        }

        // Justificativa aprovada abona o dia: some a pendência e o atraso, e o status vira "justificado".
        if (justificativa === 'aprovada') {
            return { ...dia, statusFinal: 'justificado', atrasoMin: 0, pendenteMin: 0, aberto: false };
        }
        return dia;
    })
);

export interface Totais {
    previstoMin: number;
    trabalhadoMin: number;
    pendenteMin: number;
    excedenteMin: number;
    atrasoMin: number;
    faltas: number;
    incompletos: number;
}

const somar = (dias: readonly DiaApurado[]): Totais => dias.reduce<Totais>((totais, dia) => ({
    previstoMin: totais.previstoMin + dia.previstoMin,
    trabalhadoMin: totais.trabalhadoMin + (dia.trabalhadoMin ?? 0),
    pendenteMin: totais.pendenteMin + dia.pendenteMin,
    excedenteMin: totais.excedenteMin + dia.excedenteMin,
    atrasoMin: totais.atrasoMin + dia.atrasoMin,
    faltas: totais.faltas + (dia.statusFinal === 'falta' ? 1 : 0),
    incompletos: totais.incompletos + (dia.statusFinal === 'incompleto' ? 1 : 0),
}), { previstoMin: 0, trabalhadoMin: 0, pendenteMin: 0, excedenteMin: 0, atrasoMin: 0, faltas: 0, incompletos: 0 });

export interface SemanaApurada extends Totais {
    // Primeiro e último dia do mês que caem na semana (segunda a domingo).
    de: string;
    ate: string;
}

// Totais do mês e de cada semana (segunda a domingo) que o mês toca, só com os dias do próprio mês.
export const totalizarMes = (dias: readonly DiaApurado[]): { semanas: SemanaApurada[]; mes: Totais } => {
    const semanas: DiaApurado[][] = [];
    for (const dia of dias) {
        const segunda = new Date(`${dia.data}T00:00:00Z`).getUTCDay() === 1;
        if (segunda || semanas.length === 0) semanas.push([]);
        semanas[semanas.length - 1].push(dia);
    }
    return {
        semanas: semanas.map((grupo) => ({ de: grupo[0].data, ate: grupo[grupo.length - 1].data, ...somar(grupo) })),
        mes: somar(dias),
    };
};

// 'HH:MM', com tantas horas quantas forem precisas (220:00 no mês).
export const formatarMinutos = (minutos: number): string => (
    `${String(Math.floor(minutos / MINUTOS_POR_HORA)).padStart(2, '0')}:${String(minutos % MINUTOS_POR_HORA).padStart(2, '0')}`
);

export const SEM_HORARIO = '--:--';

export const formatarHorario = (minutos: number | null): string => (minutos === null ? SEM_HORARIO : formatarMinutos(minutos));

export const validarDecisao = (status: 'aprovada' | 'recusada', resposta: string | null): Validacao<string | null> => {
    if (status === 'recusada' && !resposta) return { erro: 'Informe o motivo da recusa para o colaborador.' };
    return { dados: resposta };
};
