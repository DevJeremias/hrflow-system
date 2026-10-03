// Lê o texto de um PDF gerado pelo pdfkit: os fluxos de conteúdo vêm comprimidos (Flate) e o texto das
// fontes padrão fica em strings hexadecimais dentro de arrays TJ, partidos onde há kerning. Só serve para
// conferir o que o relatório imprimiu, não é um leitor de PDF.
import zlib from 'node:zlib';

export const textosDoPdf = (pdf: Buffer): string[] => {
    const textos: string[] = [];
    for (const [, fluxo] of pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
        let conteudo: string;
        try {
            conteudo = zlib.inflateSync(Buffer.from(fluxo, 'latin1')).toString('latin1');
        } catch {
            continue;
        }
        for (const [, array] of conteudo.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
            const pedacos = [...array.matchAll(/<([0-9a-fA-F]*)>/g)].map(([, hex]) => Buffer.from(hex, 'hex').toString('latin1'));
            textos.push(pedacos.join('').replace(/ /g, ' '));
        }
    }
    return textos;
};
