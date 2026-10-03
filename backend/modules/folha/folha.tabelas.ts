// Tabelas de INSS por vigência. Para uma tabela nova, acrescente uma entrada com o próprio
// vigencia_inicio: o cálculo escolhe a tabela pela competência e não precisa mudar.
// Valores em centavos; a alíquota é em milésimos (75 = 7,5%).
export interface FaixaInss {
    // Teto da faixa em centavos; a última faixa termina no teto de contribuição.
    ate: number;
    aliquota: number;
}

export interface TabelaInss {
    // Primeiro dia (AAAA-MM-DD) em que a tabela vale.
    vigencia_inicio: string;
    faixas: readonly FaixaInss[];
}

// Portaria Interministerial MPS/MF nº 13/2026: contribuição máxima de R$ 988,09.
export const TABELAS_INSS: readonly TabelaInss[] = [
    {
        vigencia_inicio: '2026-01-01',
        faixas: [
            { ate: 162100, aliquota: 75 },
            { ate: 290284, aliquota: 90 },
            { ate: 435427, aliquota: 120 },
            { ate: 847555, aliquota: 140 },
        ],
    },
];

// Tabelas de IRRF por vigência, no mesmo molde das de INSS. Valores em centavos; alíquota em
// milésimos (275 = 27,5%); `deduzir` é a parcela a deduzir da faixa.
export interface FaixaIrrf {
    // Teto da base de cálculo da faixa em centavos; a última faixa não tem teto.
    ate: number | null;
    aliquota: number;
    deduzir: number;
}

// Redução do imposto sobre o rendimento tributável do mês (Lei 9.250/1995, art. 3º-A, incluído pela
// Lei 15.270/2025). Até `ateFixa` ela vale `fixa`, limitada ao imposto da tabela (o imposto cai a
// zero); de `ateFixa` até `ateDecrescente` vale `base` menos `coeficiente` (em milionésimos) vezes o
// rendimento, e deixa de existir a partir daí.
export interface ReducaoIrrf {
    ateFixa: number;
    fixa: number;
    ateDecrescente: number;
    base: number;
    coeficiente: number;
}

export interface TabelaIrrf {
    vigencia_inicio: string;
    faixas: readonly FaixaIrrf[];
    deducaoPorDependente: number;
    // Substitui as deduções legais quando é mais vantajoso (25% da primeira faixa da tabela).
    descontoSimplificado: number;
    reducao: ReducaoIrrf | null;
}

// Receita Federal, "Tributação de 2026": tabela mensal a partir de janeiro de 2026, dedução por
// dependente de R$ 189,59, desconto simplificado de R$ 607,20 e a tabela de redução mensal.
export const TABELAS_IRRF: readonly TabelaIrrf[] = [
    {
        vigencia_inicio: '2026-01-01',
        faixas: [
            { ate: 242880, aliquota: 0, deduzir: 0 },
            { ate: 282665, aliquota: 75, deduzir: 18216 },
            { ate: 375105, aliquota: 150, deduzir: 39416 },
            { ate: 466468, aliquota: 225, deduzir: 67549 },
            { ate: null, aliquota: 275, deduzir: 90873 },
        ],
        deducaoPorDependente: 18959,
        descontoSimplificado: 60720,
        reducao: { ateFixa: 500000, fixa: 31289, ateDecrescente: 735000, base: 97862, coeficiente: 133145 },
    },
];

// Alíquotas patronais por regime tributário, em milésimos da remuneração. O FGTS (8%) é devido em
// qualquer regime e não está aqui; o Simples Nacional recolhe a contribuição patronal dentro do DAS.
export interface EncargoPatronal {
    codigo: string;
    descricao: string;
    aliquota: number;
}

export type RegimeTributario = 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real';

// Lucro Presumido e Lucro Real: CPP 20% + RAT 2% (grau de risco médio, FAP 1,0) + terceiros 5,8%,
// os 27,8% que a folha sempre estimou. Sem regime informado vale a mesma regra.
export const ENCARGOS_PATRONAIS_GERAIS: readonly EncargoPatronal[] = [
    { codigo: 'INSS_PATRONAL', descricao: 'INSS patronal (CPP)', aliquota: 200 },
    { codigo: 'RAT', descricao: 'RAT/SAT', aliquota: 20 },
    { codigo: 'TERCEIROS', descricao: 'Terceiros (Sistema S e salário-educação)', aliquota: 58 },
];

export const ENCARGOS_PATRONAIS_POR_REGIME: Record<RegimeTributario, readonly EncargoPatronal[]> = {
    'Simples Nacional': [],
    'Lucro Presumido': ENCARGOS_PATRONAIS_GERAIS,
    'Lucro Real': ENCARGOS_PATRONAIS_GERAIS,
};

export const ALIQUOTA_FGTS = 80;
