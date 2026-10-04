// O PDF de um relatório: cabeçalho com a empresa, o título e o período, a tabela com os totais em destaque
// e o rodapé com a página. Fontes padrão do PDF (Helvetica), que cobrem a acentuação do português.
import PDFDocument from 'pdfkit';
import { formatarParaLeitura } from './relatorios.tabela.ts';
import type { Coluna, Linha, Tabela } from './relatorios.tabela.ts';

const MARGEM = 40;
const ALTURA_DA_LINHA = 20;
const COR_DA_MARCA = '#4f46e5';
const COR_DO_TEXTO = '#1f2937';
const COR_SECUNDARIA = '#6b7280';
const COR_DO_FUNDO = '#f3f4f6';
const FONTE = 'Helvetica';
const FONTE_NEGRITO = 'Helvetica-Bold';

// A primeira coluna (o nome) recebe o dobro das demais; muitas colunas pedem a página deitada.
const MAXIMO_DE_COLUNAS_EM_PE = 5;

const larguras = (colunas: readonly Coluna[], larguraUtil: number): number[] => {
    const pesos = colunas.map((coluna, indice) => (indice === 0 || coluna.tipo === 'texto' ? 2 : 1));
    const soma = pesos.reduce((total, peso) => total + peso, 0);
    return pesos.map((peso) => (peso / soma) * larguraUtil);
};

export const gerarPdf = (tabela: Tabela): Promise<Buffer> => new Promise((resolve, reject) => {
    const doc = new PDFDocument({
        size: 'A4',
        layout: tabela.colunas.length > MAXIMO_DE_COLUNAS_EM_PE ? 'landscape' : 'portrait',
        margin: MARGEM,
        bufferPages: true,
        info: { Title: `${tabela.titulo} - ${tabela.empresa}`, Author: 'HRFlow', Subject: tabela.subtitulo },
    });
    const partes: Buffer[] = [];
    doc.on('data', (parte: Buffer) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const larguraUtil = doc.page.width - 2 * MARGEM;
    const colunas = larguras(tabela.colunas, larguraUtil);
    const limiteInferior = () => doc.page.height - MARGEM - 24;

    const cabecalhoDaPagina = () => {
        doc.font(FONTE_NEGRITO).fontSize(10).fillColor(COR_DA_MARCA).text('HRFlow', MARGEM, MARGEM);
        doc.font(FONTE_NEGRITO).fontSize(16).fillColor(COR_DO_TEXTO).text(tabela.titulo, MARGEM, doc.y + 4);
        doc.font(FONTE).fontSize(10).fillColor(COR_SECUNDARIA).text(`${tabela.empresa} · ${tabela.subtitulo}`, MARGEM, doc.y + 2);
        doc.moveDown(1);
    };

    const desenharLinha = (linha: Linha | null, rotulos: boolean, destaque: boolean) => {
        if (doc.y + ALTURA_DA_LINHA > limiteInferior()) {
            doc.addPage();
            doc.y = MARGEM;
            desenharLinha(null, true, false);
        }
        const y = doc.y;
        if (rotulos || destaque) doc.rect(MARGEM, y - 3, larguraUtil, ALTURA_DA_LINHA).fill(COR_DO_FUNDO);
        let x = MARGEM;
        tabela.colunas.forEach((coluna, indice) => {
            const texto = rotulos ? coluna.rotulo : formatarParaLeitura(linha![coluna.chave] ?? '', coluna.tipo);
            doc.font(rotulos || destaque ? FONTE_NEGRITO : FONTE).fontSize(9).fillColor(COR_DO_TEXTO)
                .text(texto, x + 4, y + 1, { width: colunas[indice] - 8, height: ALTURA_DA_LINHA - 4, ellipsis: true, lineBreak: false, align: coluna.tipo === 'texto' ? 'left' : 'right' });
            x += colunas[indice];
        });
        doc.y = y + ALTURA_DA_LINHA;
    };

    cabecalhoDaPagina();
    desenharLinha(null, true, false);
    for (const linha of tabela.linhas) desenharLinha(linha, false, false);
    if (tabela.linhas.length === 0) {
        doc.font(FONTE).fontSize(10).fillColor(COR_SECUNDARIA).text('Nenhum registro neste período.', MARGEM, doc.y + 8);
    }
    if (tabela.total) desenharLinha(tabela.total, false, true);

    // O rodapé leva a página e o instante da geração, escritos depois que o total de páginas é conhecido.
    const paginas = doc.bufferedPageRange();
    for (let i = 0; i < paginas.count; i += 1) {
        doc.switchToPage(paginas.start + i);
        // O rodapé fica dentro da margem inferior: sem zerá-la o pdfkit abriria uma página nova para ele.
        doc.page.margins.bottom = 0;
        doc.font(FONTE).fontSize(8).fillColor(COR_SECUNDARIA)
            .text(`Gerado em ${tabela.geradoEm}`, MARGEM, doc.page.height - MARGEM - 8, { width: larguraUtil / 2, lineBreak: false, align: 'left' })
            .text(`Página ${i + 1} de ${paginas.count}`, MARGEM + larguraUtil / 2, doc.page.height - MARGEM - 8, { width: larguraUtil / 2, lineBreak: false, align: 'right' });
    }
    doc.end();
});
