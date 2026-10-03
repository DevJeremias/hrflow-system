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
