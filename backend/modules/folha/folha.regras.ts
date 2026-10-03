// Regras da folha que não dependem do banco. Todo cálculo é feito em centavos inteiros e só
// a saída volta para reais, então nenhum valor monetário sai com mais de duas casas.
import { TABELAS_INSS, type TabelaInss } from './folha.tabelas.ts';

const ENCARGOS_PATRONAIS = 278; // milésimos do salário (27,8%), estimativa fixa até haver regime tributário

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
): Holerite => {
    const bruto = emCentavos(salario);
    const inss = calcularInssEmCentavos(bruto, tabelaVigente(dia, tabelas));
    return {
        baseSalary: emReais(bruto),
        inss: emReais(inss),
        netSalary: emReais(bruto - inss),
        employerCharges: emReais(centavosDe(bruto * ENCARGOS_PATRONAIS)),
    };
};
