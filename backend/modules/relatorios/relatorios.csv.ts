// CSV para o Excel brasileiro: UTF-8 com BOM (sem ele a acentuação se perde ao abrir com duplo clique),
// ponto e vírgula entre as colunas e vírgula decimal, linhas terminadas em CRLF.
import type { Coluna, Linha, Tabela } from './relatorios.tabela.ts';

export const BOM = '﻿';

// O Excel executa como fórmula a célula que começa com = + - @ (tab e CR também): um nome de colaborador
// assim viraria um comando. O apóstrofo na frente o mantém texto. Número negativo de verdade não passa
// por aqui, só texto.
const FORMULA = /^[=+\-@\t\r]/;

const celulaDeTexto = (texto: string): string => {
    const seguro = FORMULA.test(texto) ? `'${texto}` : texto;
    return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
};

// Moeda e percentual saem como número puro com vírgula decimal ("1234,56", "12,5"), que o Excel soma;
// o símbolo vai no rótulo da coluna.
const celula = (valor: string | number | undefined, coluna: Coluna): string => {
    if (valor === undefined) return '';
    if (typeof valor === 'number') {
        if (coluna.tipo === 'moeda') return valor.toFixed(2).replace('.', ',');
        if (coluna.tipo === 'percentual') return valor.toFixed(1).replace('.', ',');
        return String(valor);
    }
    return celulaDeTexto(valor);
};

const ROTULO_DA_UNIDADE: Record<Coluna['tipo'], string> = { texto: '', inteiro: '', moeda: ' (R$)', percentual: ' (%)' };

export const gerarCsv = (tabela: Tabela): Buffer => {
    const cabecalho = tabela.colunas.map((coluna) => celulaDeTexto(`${coluna.rotulo}${ROTULO_DA_UNIDADE[coluna.tipo]}`));
    const linhaDe = (linha: Linha) => tabela.colunas.map((coluna) => celula(linha[coluna.chave], coluna)).join(';');
    const linhas = [cabecalho.join(';'), ...tabela.linhas.map(linhaDe), ...(tabela.total ? [linhaDe(tabela.total)] : [])];
    return Buffer.from(`${BOM}${linhas.join('\r\n')}\r\n`, 'utf8');
};
