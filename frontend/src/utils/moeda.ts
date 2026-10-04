const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarMoeda = (valor: number): string => MOEDA.format(valor);

// 12,5 como "12,5%": o percentual que a API entrega já vem em %, com uma casa.
export const formatarPercentual = (valor: number): string => `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
