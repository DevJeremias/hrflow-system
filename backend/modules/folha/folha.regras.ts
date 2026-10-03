// Regras da folha que não dependem do banco. Todo cálculo é feito em centavos inteiros e só
// a saída volta para reais, então nenhum valor monetário sai com mais de duas casas.
import { TABELAS_INSS, type TabelaInss } from './folha.tabelas.ts';

const ENCARGOS_PATRONAIS = 278; // milésimos do salário (27,8%), estimativa fixa até haver regime tributário

// Contratos sem vínculo CLT: o PJ presta serviço e o estágio é regido pela Lei 11.788, então nenhum
// dos dois sofre desconto de INSS em folha nem gera encargo patronal CLT. Contrato não informado
// (a coluna é opcional) segue a regra geral, a mesma que a folha sempre aplicou.
const CONTRATOS_SEM_VINCULO_CLT: readonly string[] = ['PJ', 'Estágio'];

export const temVinculoClt = (tipoContrato: string | null): boolean => !CONTRATOS_SEM_VINCULO_CLT.includes(tipoContrato ?? '');

export const emCentavos = (reais: number): number => Math.round(reais * 100);

export const emReais = (centavos: number): number => centavos / 100;

// Arredonda meio para cima: valorEmMilesimosDeCentavo é centavos * alíquota em milésimos.
const centavosDe = (valorEmMilesimosDeCentavo: number): number => Math.floor((valorEmMilesimosDeCentavo + 500) / 1000);

// Tabela mais recente cuja vigência já começou em 'dia' (AAAA-MM-DD, comparação lexicográfica).
export const tabelaVigente = (dia: string, tabelas: readonly TabelaInss[] = TABELAS_INSS): TabelaInss => {
    const vigente = tabelas
        .filter((tabela) => tabela.vigencia_inicio <= dia)
        .reduce<TabelaInss | null>((a, b) => (a && a.vigencia_inicio > b.vigencia_inicio ? a : b), null);
    if (!vigente) throw new Error(`Nenhuma tabela de INSS vigente em ${dia}.`);
    return vigente;
};

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

// A folha de uma competência só existe se há tabela de INSS vigente no primeiro dia dela.
export const haTabelaVigente = (dia: string, tabelas: readonly TabelaInss[] = TABELAS_INSS): boolean =>
    tabelas.some((tabela) => tabela.vigencia_inicio <= dia);

const DIAS_DO_MES_COMERCIAL = 30;

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
    netSalary: number;
    employerCharges: number;
}

export const calcularHolerite = (
    salario: number,
    dia: string = new Date().toISOString().slice(0, 10),
    tabelas: readonly TabelaInss[] = TABELAS_INSS,
    tipoContrato: string | null = null,
    diasDeFerias = 0,
): Holerite => {
    const bruto = emCentavos(salario);
    const clt = temVinculoClt(tipoContrato);
    // O terço de férias integra a base do INSS e a dos encargos, como o salário.
    const terco = tercoDeFeriasEmCentavos(bruto, diasDeFerias, tipoContrato);
    const inss = clt ? calcularInssEmCentavos(bruto + terco, tabelaVigente(dia, tabelas)) : 0;
    return {
        baseSalary: emReais(bruto),
        inss: emReais(inss),
        netSalary: emReais(bruto + terco - inss),
        employerCharges: emReais(clt ? centavosDe((bruto + terco) * ENCARGOS_PATRONAIS) : 0),
    };
};

// Linha do holerite. O valor é em reais, com no máximo duas casas.
export interface Rubrica {
    codigo: string;
    descricao: string;
    tipo: 'provento' | 'desconto';
    valor: number;
}

export const CODIGO_SALARIO = 'SALARIO';
export const CODIGO_TERCO_DE_FERIAS = 'FERIAS_TERCO';

// As rubricas que o cálculo gera hoje: o salário, o terço de férias quando há (`tercoDeFerias`, em
// reais) e, para quem tem vínculo CLT, o INSS.
export const rubricasDoHolerite = ({ baseSalary, inss }: Holerite, tercoDeFerias = 0): Rubrica[] => [
    { codigo: CODIGO_SALARIO, descricao: 'Salário Base', tipo: 'provento', valor: baseSalary },
    ...(tercoDeFerias > 0 ? [{ codigo: CODIGO_TERCO_DE_FERIAS, descricao: 'Terço Constitucional de Férias', tipo: 'provento' as const, valor: tercoDeFerias }] : []),
    ...(inss > 0 ? [{ codigo: 'INSS', descricao: 'Desconto INSS', tipo: 'desconto' as const, valor: inss }] : []),
];
