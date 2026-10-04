// O que todo relatório exportável tem em comum: uma tabela com título, colunas tipadas, linhas e,
// às vezes, um total. O CSV e o PDF são duas leituras da mesma tabela, então os dois mostram os mesmos
// números que o JSON.
export type TipoDeColuna = 'texto' | 'inteiro' | 'moeda' | 'percentual';

export interface Coluna {
    chave: string;
    rotulo: string;
    tipo: TipoDeColuna;
}

export type Linha = Record<string, string | number>;

export interface Tabela {
    titulo: string;
    subtitulo: string;
    // Nome da empresa e instante da geração ('02/10/2026 14:30', no fuso dela), para o cabeçalho do PDF.
    empresa: string;
    geradoEm: string;
    colunas: Coluna[];
    linhas: Linha[];
    // Última linha, em destaque, com os totais que a tabela soma.
    total: Linha | null;
    // Base do nome do arquivo exportado, sem extensão e só com letras, números e hífen.
    arquivo: string;
}

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const INTEIRO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const DECIMAL_DE_UMA_CASA = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Como a tela de leitura (e o PDF) escreve o valor: "R$ 1.234,56", "1.234", "12,5%".
export const formatarParaLeitura = (valor: string | number, tipo: TipoDeColuna): string => {
    if (typeof valor === 'string') return valor;
    if (tipo === 'moeda') return MOEDA.format(valor);
    if (tipo === 'percentual') return `${DECIMAL_DE_UMA_CASA.format(valor)}%`;
    return INTEIRO.format(valor);
};
