// Leitor de CSV (RFC 4180) para as importações: campos entre aspas com vírgula, quebra de linha e
// aspas duplicadas, BOM no começo e fim de linha CRLF. O delimitador (vírgula, ponto e vírgula ou
// tabulação) vem da primeira linha: o Excel em português exporta com ponto e vírgula.

export interface RegistroCsv {
    // Linha do arquivo onde o registro começa (a primeira é 1), para apontar o erro a quem o corrige.
    linha: number;
    campos: string[];
}

const DELIMITADORES = [',', ';', '\t'] as const;

const detectarDelimitador = (texto: string): string => {
    const primeiraLinha = texto.split(/\r?\n/, 1)[0];
    let fora = true;
    const contagem = new Map<string, number>();
    for (const caractere of primeiraLinha) {
        if (caractere === '"') fora = !fora;
        else if (fora && (DELIMITADORES as readonly string[]).includes(caractere)) contagem.set(caractere, (contagem.get(caractere) ?? 0) + 1);
    }
    return [...contagem].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ',';
};

export const lerCsv = (conteudo: string): RegistroCsv[] => {
    const texto = conteudo.replace(/^﻿/, '');
    const delimitador = detectarDelimitador(texto);
    const registros: RegistroCsv[] = [];
    let campos: string[] = [];
    let campo = '';
    let entreAspas = false;
    let linha = 1;
    let linhaDoRegistro = 1;

    const fecharCampo = () => {
        campos.push(campo);
        campo = '';
    };
    const fecharRegistro = () => {
        fecharCampo();
        // Linha em branco (ou só com delimitadores vazios) não é registro.
        if (campos.some((valor) => valor.trim() !== '')) registros.push({ linha: linhaDoRegistro, campos });
        campos = [];
    };

    for (let i = 0; i < texto.length; i += 1) {
        const caractere = texto[i];
        if (entreAspas) {
            if (caractere === '"' && texto[i + 1] === '"') {
                campo += '"';
                i += 1;
            } else if (caractere === '"') {
                entreAspas = false;
            } else {
                if (caractere === '\n') linha += 1;
                campo += caractere;
            }
        } else if (caractere === '"') {
            entreAspas = true;
        } else if (caractere === delimitador) {
            fecharCampo();
        } else if (caractere === '\n' || caractere === '\r') {
            if (caractere === '\r' && texto[i + 1] === '\n') i += 1;
            fecharRegistro();
            linha += 1;
            linhaDoRegistro = linha;
        } else {
            campo += caractere;
        }
    }
    fecharRegistro();
    return registros;
};
