// Regras da folha que não dependem do banco. Todo cálculo é feito em centavos inteiros e só
// a saída volta para reais, então nenhum valor monetário sai com mais de duas casas.
import {
    ALIQUOTA_FGTS, ENCARGOS_PATRONAIS_GERAIS, ENCARGOS_PATRONAIS_POR_REGIME, TABELAS_INSS, TABELAS_IRRF,
    type RegimeTributario, type TabelaInss, type TabelaIrrf,
} from './folha.tabelas.ts';

export type { RegimeTributario };

// Contratos sem vínculo CLT: o PJ presta serviço e o estágio é regido pela Lei 11.788, então nenhum
// dos dois sofre desconto de INSS nem de IRRF em folha, nem gera FGTS, hora extra ou encargo patronal
// CLT. Contrato não informado (a coluna é opcional) segue a regra geral, a mesma que a folha sempre aplicou.
const CONTRATOS_SEM_VINCULO_CLT: readonly string[] = ['PJ', 'Estágio'];

export const temVinculoClt = (tipoContrato: string | null): boolean => !CONTRATOS_SEM_VINCULO_CLT.includes(tipoContrato ?? '');

export const emCentavos = (reais: number): number => Math.round(reais * 100);

export const emReais = (centavos: number): number => centavos / 100;

// Arredonda meio para cima: valorEmMilesimosDeCentavo é centavos * alíquota em milésimos.
const centavosDe = (valorEmMilesimosDeCentavo: number): number => Math.floor((valorEmMilesimosDeCentavo + 500) / 1000);

// numerador / denominador arredondado meio para cima, sem passar por ponto flutuante.
const dividir = (numerador: number, denominador: number): number => Math.floor((2 * numerador + denominador) / (2 * denominador));

// Tabela mais recente cuja vigência já começou em 'dia' (AAAA-MM-DD, comparação lexicográfica).
const vigenteEm = <T extends { vigencia_inicio: string }>(tabelas: readonly T[], dia: string, nome: string): T => {
    const vigente = tabelas
        .filter((tabela) => tabela.vigencia_inicio <= dia)
        .reduce<T | null>((a, b) => (a && a.vigencia_inicio > b.vigencia_inicio ? a : b), null);
    if (!vigente) throw new Error(`Nenhuma tabela de ${nome} vigente em ${dia}.`);
    return vigente;
};

export const tabelaVigente = (dia: string, tabelas: readonly TabelaInss[] = TABELAS_INSS): TabelaInss => vigenteEm(tabelas, dia, 'INSS');

export const tabelaIrrfVigente = (dia: string, tabelas: readonly TabelaIrrf[] = TABELAS_IRRF): TabelaIrrf => vigenteEm(tabelas, dia, 'IRRF');

// INSS progressivo: cada faixa incide só sobre a parcela do salário que cai nela, a soma é
// arredondada uma vez no fim, e o salário acima do teto da última faixa não contribui.
export const calcularInssEmCentavos = (salarioCentavos: number, tabela: TabelaInss): number => {
    if (!(salarioCentavos > 0)) return 0;
    let acumulado = 0;
    let pisoDaFaixa = 0;
    for (const { ate, aliquota } of tabela.faixas) {
        if (salarioCentavos <= pisoDaFaixa) break;
        acumulado += (Math.min(salarioCentavos, ate) - pisoDaFaixa) * aliquota;
        pisoDaFaixa = ate;
    }
    return centavosDe(acumulado);
};

export interface IrrfCalculado {
    // Rendimento menos a dedução que valeu (legais ou simplificada), em centavos.
    baseDeCalculo: number;
    impostoDaTabela: number;
    reducao: number;
    irrf: number;
}

const impostoDaTabela = (base: number, tabela: TabelaIrrf): number => {
    if (!(base > 0)) return 0;
    const faixa = tabela.faixas.find(({ ate }) => ate === null || base <= ate)!;
    return Math.max(0, centavosDe(base * faixa.aliquota) - faixa.deduzir);
};

// A redução usa o rendimento tributável do mês (o salário), não a base de cálculo, e nunca passa
// do imposto da tabela.
const reducaoDoImposto = (rendimento: number, imposto: number, { reducao }: TabelaIrrf): number => {
    if (!reducao || rendimento > reducao.ateDecrescente) return 0;
    const devida = rendimento <= reducao.ateFixa ? reducao.fixa : reducao.base - dividir(rendimento * reducao.coeficiente, 1_000_000);
    return Math.min(imposto, Math.max(0, devida));
};

// IRRF do mês: o desconto simplificado substitui as deduções legais (INSS e dependentes) quando é
// maior que elas. Tudo em centavos, cada etapa arredondada como a Receita Federal a exemplifica.
export const calcularIrrfEmCentavos = (rendimentoCentavos: number, inssCentavos: number, dependentes: number, tabela: TabelaIrrf): IrrfCalculado => {
    if (!(rendimentoCentavos > 0)) return { baseDeCalculo: 0, impostoDaTabela: 0, reducao: 0, irrf: 0 };
    const deducaoLegal = inssCentavos + dependentes * tabela.deducaoPorDependente;
    const baseDeCalculo = Math.max(0, rendimentoCentavos - Math.max(deducaoLegal, tabela.descontoSimplificado));
    const imposto = impostoDaTabela(baseDeCalculo, tabela);
    const reducao = reducaoDoImposto(rendimentoCentavos, imposto, tabela);
    return { baseDeCalculo, impostoDaTabela: imposto, reducao, irrf: imposto - reducao };
};

// A folha de uma competência só existe se há tabela de INSS e de IRRF vigentes no primeiro dia dela.
export const haTabelaVigente = (dia: string, tabelas: readonly TabelaInss[] = TABELAS_INSS): boolean =>
    tabelas.some((tabela) => tabela.vigencia_inicio <= dia);

export const haTabelaDeIrrfVigente = (dia: string, tabelas: readonly TabelaIrrf[] = TABELAS_IRRF): boolean =>
    tabelas.some((tabela) => tabela.vigencia_inicio <= dia);

// Linha do holerite. O valor é em reais, com no máximo duas casas; `referencia` é o texto da coluna
// de referência (dias, horas, alíquota). O encargo é o que a empresa paga além do salário e não sai
// do líquido do colaborador.
export interface Rubrica {
    codigo: string;
    descricao: string;
    tipo: 'provento' | 'desconto' | 'encargo';
    valor: number;
    referencia?: string | null;
}

export const CODIGO_SALARIO = 'SALARIO';

// O que o RH lança por colaborador e mês, em reais. O vale-transporte é o custo do vale: o desconto
// do colaborador é o menor entre ele e 6% do salário.
export interface Lancamentos {
    adiantamento: number;
    valeTransporte: number;
    valeRefeicao: number;
    planoSaude: number;
}

export const SEM_LANCAMENTOS: Lancamentos = { adiantamento: 0, valeTransporte: 0, valeRefeicao: 0, planoSaude: 0 };

// O que o ponto apurou no mês (B-15): dias de falta e minutos de hora extra por adicional.
export interface EventosDoPonto {
    faltas: number;
    horasExtras50Min: number;
    horasExtras100Min: number;
}

export const SEM_EVENTOS_DO_PONTO: EventosDoPonto = { faltas: 0, horasExtras50Min: 0, horasExtras100Min: 0 };

const DIAS_DO_MES_COMERCIAL = 30;
const SEMANAS_DO_MES_COMERCIAL = 5; // 30 dias / 6 dias da semana: 40 h semanais dão o divisor 200
const MINUTOS_POR_HORA = 60;
const ALIQUOTA_VALE_TRANSPORTE = 60; // milésimos do salário (6%)

// Valor das horas extras: salário / (carga semanal * 5) por hora, com o adicional em centésimos
// (150 = hora + 50%). A carga semanal é um DECIMAL(4, 1), por isso o fator 10.
const valorDasHorasExtras = (salario: number, cargaSemanalHoras: number, minutos: number, adicional: number): number => (
    minutos > 0 ? dividir(salario * minutos * adicional * 10, Math.round(cargaSemanalHoras * 10) * SEMANAS_DO_MES_COMERCIAL * MINUTOS_POR_HORA * 100) : 0
);

export const formatarHoras = (minutos: number): string => (
    `${String(Math.floor(minutos / MINUTOS_POR_HORA)).padStart(2, '0')}:${String(minutos % MINUTOS_POR_HORA).padStart(2, '0')}`
);

const aliquotaEmTexto = (milesimos: number): string => `${String(milesimos / 10).replace('.', ',')}%`;

export const CODIGO_TERCO_DE_FERIAS = 'FERIAS_TERCO';

// O terço constitucional de férias (CF, art. 7º, XVII): um terço do salário dos dias de férias que
// caem na competência, a 1/30 do salário por dia. Só quem tem vínculo CLT o recebe. O pagamento
// antecipado, até dois dias antes de as férias começarem, não é modelado: o terço entra na folha do
// mês em que os dias de férias caem.
export const tercoDeFeriasEmCentavos = (salarioCentavos: number, diasDeFerias: number, tipoContrato: string | null): number => {
    if (!temVinculoClt(tipoContrato) || !(salarioCentavos > 0) || !(diasDeFerias > 0)) return 0;
    const dias = Math.min(diasDeFerias, DIAS_DO_MES_COMERCIAL);
    return centavosDe(salarioCentavos * dias * 1000 / (DIAS_DO_MES_COMERCIAL * 3));
};

export interface Holerite {
    baseSalary: number;
    inss: number;
    irrf: number;
    fgts: number;
    netSalary: number;
    // FGTS e contribuições patronais: o custo da folha além do salário.
    employerCharges: number;
    // Bases de cálculo, em reais.
    bases: { inss: number; fgts: number; irrf: number };
    rubricas: Rubrica[];
}

export interface EntradaDoHolerite {
    salario: number;
    // Primeiro dia da competência: escolhe as tabelas vigentes.
    dia?: string;
    tipoContrato?: string | null;
    regime?: RegimeTributario | null;
    dependentes?: number;
    cargaSemanalHoras?: number;
    ponto?: EventosDoPonto;
    // Dias de férias aprovadas que caem na competência (modules/ausencias): geram o terço de férias.
    diasDeFerias?: number;
    lancamentos?: Lancamentos;
    tabelasInss?: readonly TabelaInss[];
    tabelasIrrf?: readonly TabelaIrrf[];
}

export const calcularHolerite = ({
    salario,
    dia = new Date().toISOString().slice(0, 10),
    tipoContrato = null,
    regime = null,
    dependentes = 0,
    cargaSemanalHoras = 40,
    ponto = SEM_EVENTOS_DO_PONTO,
    diasDeFerias = 0,
    lancamentos = SEM_LANCAMENTOS,
    tabelasInss = TABELAS_INSS,
    tabelasIrrf = TABELAS_IRRF,
}: EntradaDoHolerite): Holerite => {
    const bruto = emCentavos(salario);
    const clt = temVinculoClt(tipoContrato);

    const horasExtras50 = clt ? valorDasHorasExtras(bruto, cargaSemanalHoras, ponto.horasExtras50Min, 150) : 0;
    const horasExtras100 = clt ? valorDasHorasExtras(bruto, cargaSemanalHoras, ponto.horasExtras100Min, 200) : 0;
    const faltas = Math.min(bruto, dividir(bruto * ponto.faltas, DIAS_DO_MES_COMERCIAL));
    // O terço de férias integra a base do INSS, do IRRF e do FGTS, como o salário.
    const tercoDeFerias = tercoDeFeriasEmCentavos(bruto, diasDeFerias, tipoContrato);
    const remuneracao = bruto + horasExtras50 + horasExtras100 + tercoDeFerias - faltas;

    const tabelaDoInss = clt ? tabelaVigente(dia, tabelasInss) : null;
    const inss = tabelaDoInss ? calcularInssEmCentavos(remuneracao, tabelaDoInss) : 0;
    const irrf = clt ? calcularIrrfEmCentavos(remuneracao, inss, dependentes, tabelaIrrfVigente(dia, tabelasIrrf)) : null;
    const fgts = clt ? centavosDe(remuneracao * ALIQUOTA_FGTS) : 0;
    const patronais = clt
        ? (regime ? ENCARGOS_PATRONAIS_POR_REGIME[regime] : ENCARGOS_PATRONAIS_GERAIS).map((encargo) => ({ encargo, valor: centavosDe(remuneracao * encargo.aliquota) }))
        : [];

    const valeTransporte = Math.min(centavosDe(bruto * ALIQUOTA_VALE_TRANSPORTE), emCentavos(lancamentos.valeTransporte));
    const adiantamento = emCentavos(lancamentos.adiantamento);
    const valeRefeicao = emCentavos(lancamentos.valeRefeicao);
    const planoSaude = emCentavos(lancamentos.planoSaude);

    const proventos: Rubrica[] = [
        { codigo: CODIGO_SALARIO, descricao: 'Salário Base', tipo: 'provento', valor: emReais(bruto), referencia: '30 dias' },
        ...(tercoDeFerias > 0 ? [{ codigo: CODIGO_TERCO_DE_FERIAS, descricao: 'Terço Constitucional de Férias', tipo: 'provento' as const, valor: emReais(tercoDeFerias), referencia: `${diasDeFerias} ${diasDeFerias === 1 ? 'dia' : 'dias'}` }] : []),
        ...(horasExtras50 > 0 ? [{ codigo: 'HORA_EXTRA_50', descricao: 'Horas extras 50%', tipo: 'provento' as const, valor: emReais(horasExtras50), referencia: formatarHoras(ponto.horasExtras50Min) }] : []),
        ...(horasExtras100 > 0 ? [{ codigo: 'HORA_EXTRA_100', descricao: 'Horas extras 100%', tipo: 'provento' as const, valor: emReais(horasExtras100), referencia: formatarHoras(ponto.horasExtras100Min) }] : []),
    ];
    const descontos: Rubrica[] = [
        ...(faltas > 0 ? [{ codigo: 'FALTAS', descricao: 'Faltas', tipo: 'desconto' as const, valor: emReais(faltas), referencia: `${ponto.faltas} ${ponto.faltas === 1 ? 'dia' : 'dias'}` }] : []),
        ...(inss > 0 ? [{ codigo: 'INSS', descricao: 'Desconto INSS', tipo: 'desconto' as const, valor: emReais(inss) }] : []),
        ...(irrf && irrf.irrf > 0 ? [{ codigo: 'IRRF', descricao: 'IRRF', tipo: 'desconto' as const, valor: emReais(irrf.irrf) }] : []),
        ...(adiantamento > 0 ? [{ codigo: 'ADIANTAMENTO', descricao: 'Adiantamento salarial', tipo: 'desconto' as const, valor: emReais(adiantamento) }] : []),
        ...(valeTransporte > 0 ? [{ codigo: 'VALE_TRANSPORTE', descricao: 'Vale-transporte', tipo: 'desconto' as const, valor: emReais(valeTransporte) }] : []),
        ...(valeRefeicao > 0 ? [{ codigo: 'VALE_REFEICAO', descricao: 'Vale-refeição', tipo: 'desconto' as const, valor: emReais(valeRefeicao) }] : []),
        ...(planoSaude > 0 ? [{ codigo: 'PLANO_SAUDE', descricao: 'Plano de saúde', tipo: 'desconto' as const, valor: emReais(planoSaude) }] : []),
    ];
    const encargos: Rubrica[] = [
        ...(fgts > 0 ? [{ codigo: 'FGTS', descricao: 'FGTS', tipo: 'encargo' as const, valor: emReais(fgts), referencia: aliquotaEmTexto(ALIQUOTA_FGTS) }] : []),
        ...patronais.map(({ encargo, valor }): Rubrica => ({ codigo: encargo.codigo, descricao: encargo.descricao, tipo: 'encargo', valor: emReais(valor), referencia: aliquotaEmTexto(encargo.aliquota) })),
    ];

    const totalDeProventos = bruto + horasExtras50 + horasExtras100 + tercoDeFerias;
    const totalDeDescontos = faltas + inss + (irrf?.irrf ?? 0) + adiantamento + valeTransporte + valeRefeicao + planoSaude;
    return {
        baseSalary: emReais(bruto),
        inss: emReais(inss),
        irrf: emReais(irrf?.irrf ?? 0),
        fgts: emReais(fgts),
        netSalary: emReais(totalDeProventos - totalDeDescontos),
        employerCharges: emReais(fgts + patronais.reduce((total, { valor }) => total + valor, 0)),
        bases: {
            // O salário de contribuição pára no teto da tabela.
            inss: emReais(tabelaDoInss ? Math.min(remuneracao, tabelaDoInss.faixas.at(-1)!.ate) : 0),
            fgts: emReais(clt ? remuneracao : 0),
            irrf: emReais(irrf?.baseDeCalculo ?? 0),
        },
        rubricas: [...proventos, ...descontos, ...encargos],
    };
};
