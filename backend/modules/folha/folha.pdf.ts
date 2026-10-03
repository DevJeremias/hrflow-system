// Holerite em PDF, gerado no servidor: uma página A4 por colaborador, com a razão social, o CNPJ e a
// competência da folha, as rubricas, os totais e as bases do INSS, do FGTS e do IRRF. Só usa as
// fontes embutidas do PDF (Helvetica), que cobrem o português.
import PDFDocument from 'pdfkit';
import type { DadosDoPdf, HoleriteDoColaborador } from './folha.service.ts';

const MARGEM = 40;
const LARGURA = 595.28 - 2 * MARGEM;
const COR = '#111827';
const COR_SUAVE = '#6b7280';
const COR_LINHA = '#d1d5db';
const COR_AVISO = '#b45309';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// 'AAAA-MM' como 'Outubro de 2026'.
export const nomeDaCompetencia = (competencia: string): string => `${MESES[Number(competencia.slice(5)) - 1]} de ${competencia.slice(0, 4)}`;

// 1234.5 como 'R$ 1.234,50'. À mão, para a saída não depender do ICU do Node.
export const emReaisFormatado = (valor: number): string => {
    const [inteiro, centavos] = Math.abs(valor).toFixed(2).split('.');
    return `${valor < 0 ? '-' : ''}R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${centavos}`;
};

// 12345678000195 como '12.345.678/0001-95'; o que não tem 14 dígitos sai como veio.
export const cnpjFormatado = (cnpj: string): string => (
    /^\d{14}$/.test(cnpj) ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : cnpj
);

// Nome de arquivo sem acento nem caractere que o navegador ou o sistema de arquivos recusem.
export const nomeDeArquivo = (texto: string): string => (
    texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
);

type Documento = InstanceType<typeof PDFDocument>;

const COLUNAS = [
    { chave: 'descricao', titulo: 'Descrição', x: MARGEM + 8, largura: 230, alinhamento: 'left' as const },
    { chave: 'referencia', titulo: 'Referência', x: MARGEM + 240, largura: 80, alinhamento: 'center' as const },
    { chave: 'vencimento', titulo: 'Vencimentos', x: MARGEM + 320, largura: 95, alinhamento: 'right' as const },
    { chave: 'desconto', titulo: 'Descontos', x: MARGEM + 415, largura: 92, alinhamento: 'right' as const },
];

const rotulo = (doc: Documento, texto: string, x: number, y: number, largura: number) => {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COR_SUAVE).text(texto.toUpperCase(), x, y, { width: largura, lineBreak: false });
};

const valor = (doc: Documento, texto: string, x: number, y: number, largura: number, opcoes: { negrito?: boolean; tamanho?: number } = {}) => {
    doc.font(opcoes.negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(opcoes.tamanho ?? 9.5).fillColor(COR).text(texto, x, y, { width: largura, ellipsis: true, lineBreak: false });
};

const linhaHorizontal = (doc: Documento, y: number, cor = COR_LINHA) => {
    doc.moveTo(MARGEM, y).lineTo(MARGEM + LARGURA, y).lineWidth(0.6).strokeColor(cor).stroke();
};

const escreverPagina = (doc: Documento, { competencia, status, empresa }: Omit<DadosDoPdf, 'holerites'>, holerite: HoleriteDoColaborador) => {
    let y = MARGEM;

    // Cabeçalho: a empresa à esquerda, o recibo e a referência à direita.
    doc.font('Helvetica-Bold').fontSize(13).fillColor(COR).text((empresa.razaoSocial ?? 'Empresa sem razão social').toUpperCase(), MARGEM, y, { width: 330 });
    if (empresa.cnpj) doc.font('Helvetica').fontSize(9.5).fillColor(COR_SUAVE).text(`CNPJ: ${cnpjFormatado(empresa.cnpj)}`, MARGEM, doc.y + 2, { width: 330 });
    const alturaDaEmpresa = doc.y;
    doc.font('Helvetica-Bold').fontSize(13).fillColor(COR).text('RECIBO DE PAGAMENTO', MARGEM + 300, y, { width: LARGURA - 300, align: 'right' });
    doc.font('Helvetica').fontSize(9.5).fillColor(COR_SUAVE).text(`Referência: ${nomeDaCompetencia(competencia)}`, MARGEM + 300, doc.y + 2, { width: LARGURA - 300, align: 'right' });
    y = Math.max(alturaDaEmpresa, doc.y) + 10;
    if (status === 'aberta') {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COR_AVISO).text('Folha em conferência: este holerite ainda pode mudar até o fechamento do mês.', MARGEM, y, { width: LARGURA });
        y = doc.y + 6;
    }
    linhaHorizontal(doc, y, COR);
    y += 10;

    // Colaborador.
    rotulo(doc, 'Código / Nome do funcionário', MARGEM, y, 260);
    valor(doc, `${holerite.id.padStart(4, '0')} - ${holerite.name}`, MARGEM, y + 11, 260, { negrito: true });
    rotulo(doc, 'Cargo', MARGEM + 270, y, 120);
    valor(doc, holerite.role, MARGEM + 270, y + 11, 120);
    rotulo(doc, 'Setor', MARGEM + 400, y, 115);
    valor(doc, holerite.department, MARGEM + 400, y + 11, 115);
    y += 30;
    rotulo(doc, 'Contrato', MARGEM, y, 260);
    valor(doc, holerite.contract ?? 'Não informado', MARGEM, y + 11, 260);
    y += 28;
    linhaHorizontal(doc, y, COR);

    // Rubricas: o salário, os proventos e depois os descontos.
    y += 6;
    for (const coluna of COLUNAS) {
        doc.font('Helvetica-Bold').fontSize(7).fillColor(COR_SUAVE).text(coluna.titulo.toUpperCase(), coluna.x, y, { width: coluna.largura, align: coluna.alinhamento, lineBreak: false });
    }
    y += 14;
    linhaHorizontal(doc, y - 3);
    const linhas = [
        { descricao: 'Salário Base', referencia: '30 dias', vencimento: holerite.baseSalary, desconto: null },
        ...holerite.earningsList.map((linha) => ({ descricao: linha.description, referencia: linha.reference ?? '', vencimento: linha.value, desconto: null })),
        ...holerite.deductionsList.map((linha) => ({ descricao: linha.description, referencia: linha.reference ?? '', vencimento: null, desconto: linha.value })),
    ];
    for (const linha of linhas) {
        valor(doc, linha.descricao, COLUNAS[0].x, y, COLUNAS[0].largura);
        doc.font('Helvetica').fontSize(9.5).fillColor(COR).text(linha.referencia, COLUNAS[1].x, y, { width: COLUNAS[1].largura, align: 'center', lineBreak: false });
        if (linha.vencimento !== null) doc.font('Helvetica').fontSize(9.5).fillColor(COR).text(emReaisFormatado(linha.vencimento), COLUNAS[2].x, y, { width: COLUNAS[2].largura, align: 'right', lineBreak: false });
        if (linha.desconto !== null) doc.font('Helvetica').fontSize(9.5).fillColor(COR).text(emReaisFormatado(linha.desconto), COLUNAS[3].x, y, { width: COLUNAS[3].largura, align: 'right', lineBreak: false });
        y += 16;
    }
    y += 6;
    linhaHorizontal(doc, y, COR);

    // Totais.
    y += 8;
    rotulo(doc, 'Total de vencimentos', MARGEM + 250, y, 150);
    valor(doc, emReaisFormatado(holerite.totalGross), MARGEM + 400, y - 2, 107, { negrito: true });
    y += 16;
    rotulo(doc, 'Total de descontos', MARGEM + 250, y, 150);
    valor(doc, emReaisFormatado(holerite.totalDeductions), MARGEM + 400, y - 2, 107, { negrito: true });
    y += 18;
    doc.rect(MARGEM + 240, y, LARGURA - 240, 28).fill(COR);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text('VALOR LÍQUIDO A RECEBER', MARGEM + 250, y + 10, { width: 150, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff').text(emReaisFormatado(holerite.netSalary), MARGEM + 400, y + 7, { width: 107, align: 'right', lineBreak: false });
    y += 28;
    doc.fillColor(COR);

    // Bases de cálculo e FGTS: informativas, não entram nos totais acima.
    y += 18;
    linhaHorizontal(doc, y);
    y += 8;
    const informativos = holerite.bases
        ? [
            ['Base INSS', emReaisFormatado(holerite.bases.inss)],
            ['Base FGTS', emReaisFormatado(holerite.bases.fgts)],
            ['FGTS do mês', emReaisFormatado(holerite.fgts)],
            ['Base IRRF', emReaisFormatado(holerite.bases.irrf)],
            ['Dependentes IRRF', String(holerite.dependents)],
        ]
        : [['FGTS do mês', emReaisFormatado(holerite.fgts)]];
    const larguraDaColuna = LARGURA / informativos.length;
    informativos.forEach(([titulo, texto], indice) => {
        const x = MARGEM + indice * larguraDaColuna;
        rotulo(doc, titulo, x, y, larguraDaColuna - 6);
        valor(doc, texto, x, y + 11, larguraDaColuna - 6, { negrito: true });
    });
    y += 34;
    linhaHorizontal(doc, y);

    // Recibo e assinatura.
    y += 18;
    doc.font('Helvetica').fontSize(8.5).fillColor(COR_SUAVE).text('Declaro ter recebido a importância líquida discriminada neste recibo.', MARGEM, y, { width: LARGURA });
    y += 50;
    doc.moveTo(MARGEM + 40, y).lineTo(MARGEM + 300, y).lineWidth(0.6).strokeColor(COR_SUAVE).stroke();
    rotulo(doc, 'Assinatura do funcionário', MARGEM + 40, y + 5, 260);
    rotulo(doc, 'Data', MARGEM + 340, y + 5, 80);
    doc.moveTo(MARGEM + 340, y).lineTo(MARGEM + 460, y).stroke();
};

// Escreve o PDF inteiro (já encerrado) com uma página por holerite. A saída é um fluxo: o chamador
// o encaminha com `.pipe`. `comprimir: false` deixa o conteúdo legível para quem o inspeciona.
export const criarPdfDeHolerites = ({ holerites, ...folha }: DadosDoPdf, { comprimir = true }: { comprimir?: boolean } = {}): Documento => {
    const doc = new PDFDocument({
        size: 'A4',
        margin: MARGEM,
        compress: comprimir,
        autoFirstPage: false,
        info: { Title: `Holerites ${nomeDaCompetencia(folha.competencia)}`, Author: folha.empresa.razaoSocial ?? 'HRFlow', Creator: 'HRFlow' },
    });
    for (const holerite of holerites) {
        doc.addPage();
        escreverPagina(doc, folha, holerite);
    }
    doc.end();
    return doc;
};
