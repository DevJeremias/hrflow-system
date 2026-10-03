// As contas, o CSV e o PDF dos relatórios, sem banco: rodam sempre.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as regras from '../modules/relatorios/relatorios.regras.ts';
import { gerarCsv, BOM } from '../modules/relatorios/relatorios.csv.ts';
import { gerarPdf } from '../modules/relatorios/relatorios.pdf.ts';
import { formatarParaLeitura } from '../modules/relatorios/relatorios.tabela.ts';
import type { Tabela } from '../modules/relatorios/relatorios.tabela.ts';
import { textosDoPdf } from './support/pdf.ts';
import type { HoleriteDoColaborador } from '../modules/folha/index.ts';
import type { ColaboradorApurado, DiaApurado } from '../modules/ponto/index.ts';

describe('meses de um período', () => {
    it('lista cada mês de de a ate, inclusive, atravessando o ano', () => {
        assert.deepEqual(regras.mesesEntre('2026-01', '2026-03'), ['2026-01', '2026-02', '2026-03']);
        assert.deepEqual(regras.mesesEntre('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02']);
        assert.deepEqual(regras.mesesEntre('2026-05', '2026-05'), ['2026-05']);
        assert.deepEqual(regras.mesesEntre('2026-06', '2026-05'), []);
    });

    it('acha o último dia de cada mês, inclusive fevereiro bissexto', () => {
        assert.equal(regras.ultimoDiaDoMes('2026-02'), '2026-02-28');
        assert.equal(regras.ultimoDiaDoMes('2028-02'), '2028-02-29');
        assert.equal(regras.ultimoDiaDoMes('2026-12'), '2026-12-31');
        assert.equal(regras.primeiroDiaDoMes('2026-12'), '2026-12-01');
    });
});

describe('headcount e turnover', () => {
    it('cada mês soma os admitidos e tira os desligados do anterior', () => {
        const linhas = regras.montarHeadcount({
            meses: ['2026-01', '2026-02', '2026-03'],
            ativosAntes: 10,
            admitidosPorMes: new Map([['2026-01', 4], ['2026-03', 1]]),
            desligadosPorMes: new Map([['2026-02', 2], ['2026-03', 1]]),
        });
        assert.deepEqual(linhas, [
            { mes: '2026-01', admitidos: 4, desligados: 0, ativos: 14, turnover: 0 },
            { mes: '2026-02', admitidos: 0, desligados: 2, ativos: 12, turnover: 15.4 },
            { mes: '2026-03', admitidos: 1, desligados: 1, ativos: 12, turnover: 8.3 },
        ]);
    });

    it('o turnover é dos desligamentos sobre a média de ativos, e zero quando a empresa está vazia', () => {
        assert.equal(regras.percentual(1, 20), 5);
        assert.equal(regras.percentual(1, 3), 33.3);
        assert.equal(regras.percentual(0, 0), 0);
        const vazio = regras.montarHeadcount({ meses: ['2026-01'], ativosAntes: 0, admitidosPorMes: new Map(), desligadosPorMes: new Map() });
        assert.deepEqual(vazio, [{ mes: '2026-01', admitidos: 0, desligados: 0, ativos: 0, turnover: 0 }]);
    });
});

const holerite = (department: string, totalGross: number, totalDeductions: number, netSalary: number, employerCharges: number): HoleriteDoColaborador => ({
    id: '1', name: 'Pessoa', role: 'Cargo', department, contract: 'CLT', baseSalary: totalGross, totalEarnings: 0, totalDeductions,
    totalGross, netSalary, employerCharges, earningsList: [], deductionsList: [],
});

describe('custo por departamento', () => {
    it('soma em centavos: a soma das linhas é exatamente o total, sem erro de ponto flutuante', () => {
        const { linhas, total } = regras.custoPorDepartamento([
            holerite('Vendas', 0.1, 0.01, 0.09, 0.02),
            holerite('Vendas', 0.2, 0.02, 0.18, 0.04),
            holerite('Financeiro', 1000.1, 100.01, 900.09, 80.01),
        ]);
        assert.deepEqual(linhas.map((l) => l.departamento), ['Financeiro', 'Vendas']);
        const vendas = linhas[1];
        assert.deepEqual(vendas, { departamento: 'Vendas', colaboradores: 2, bruto: 0.3, descontos: 0.03, liquido: 0.27, encargos: 0.06, custoTotal: 0.36 });
        assert.deepEqual(total, { departamento: 'Total', colaboradores: 3, bruto: 1000.4, descontos: 100.04, liquido: 900.36, encargos: 80.07, custoTotal: 1080.47 });
    });

    it('sem holerites o total é zero', () => {
        const { linhas, total } = regras.custoPorDepartamento([]);
        assert.deepEqual(linhas, []);
        assert.equal(total.custoTotal, 0);
    });
});

const dia = (data: string, parcial: Partial<DiaApurado>): DiaApurado => ({
    data, marcas: { entrada: 480, pausa: null, retorno: null, saida: 1020 }, status: 'ok', trabalhadoMin: 540, atrasoMin: 0, pendenteMin: 0, excedenteMin: 60,
    statusFinal: 'ok', aberto: false, previstoMin: 480, ...parcial,
});
const SEM_MARCAS = { entrada: null, pausa: null, retorno: null, saida: null };

describe('absenteísmo', () => {
    it('conta faltas, ausências justificadas e atrasos só nos dias úteis já apurados', () => {
        const colaborador = (departamento: string | null, dias: DiaApurado[]): ColaboradorApurado => ({ funcionarioId: 1, nome: 'Pessoa', departamento, dias });
        const { linhas, total } = regras.absenteismoPorDepartamento([
            colaborador('Vendas', [
                dia('2026-03-02', {}),
                dia('2026-03-03', { marcas: SEM_MARCAS, statusFinal: 'falta', trabalhadoMin: null }),
                dia('2026-03-04', { marcas: SEM_MARCAS, statusFinal: 'justificado', trabalhadoMin: null }),
                dia('2026-03-05', { statusFinal: 'atraso', atrasoMin: 30 }),
                // Fora da conta: um justificado COM marcação não é ausência, o fim de semana, o dia aberto e o anterior à admissão.
                dia('2026-03-06', { statusFinal: 'justificado' }),
                dia('2026-03-07', { statusFinal: 'fim_de_semana', previstoMin: 0 }),
                dia('2026-03-09', { marcas: SEM_MARCAS, aberto: true, trabalhadoMin: null }),
                dia('2026-02-27', { marcas: SEM_MARCAS, aberto: true, previstoMin: 0, trabalhadoMin: null }),
            ]),
            colaborador(null, [dia('2026-03-02', {}), dia('2026-03-03', { marcas: SEM_MARCAS, statusFinal: 'falta', trabalhadoMin: null })]),
        ]);
        assert.deepEqual(linhas, [
            { departamento: 'Sem departamento', colaboradores: 1, diasApurados: 2, faltas: 1, ausenciasJustificadas: 0, atrasos: 0, taxa: 50 },
            { departamento: 'Vendas', colaboradores: 1, diasApurados: 5, faltas: 1, ausenciasJustificadas: 1, atrasos: 1, taxa: 40 },
        ]);
        assert.deepEqual(total, { departamento: 'Total', colaboradores: 2, diasApurados: 7, faltas: 2, ausenciasJustificadas: 1, atrasos: 1, taxa: 42.9 });
    });

    it('sem dias apurados a taxa é zero, não NaN', () => {
        assert.equal(regras.absenteismoPorDepartamento([]).total.taxa, 0);
    });
});

const tabela: Tabela = {
    titulo: 'Custo por departamento', subtitulo: 'Competência 10/2026 · folha fechada', empresa: 'Empresa Açaí Ltda', geradoEm: '02/10/2026 14:30',
    colunas: [
        { chave: 'departamento', rotulo: 'Departamento', tipo: 'texto' },
        { chave: 'colaboradores', rotulo: 'Colaboradores', tipo: 'inteiro' },
        { chave: 'bruto', rotulo: 'Bruto', tipo: 'moeda' },
        { chave: 'taxa', rotulo: 'Taxa', tipo: 'percentual' },
    ],
    linhas: [{ departamento: 'Gestão e Pessoas', colaboradores: 2, bruto: 1234.5, taxa: 12.5 }, { departamento: 'Tecnologia', colaboradores: 1, bruto: 3000, taxa: 0 }],
    total: { departamento: 'Total', colaboradores: 3, bruto: 4234.5, taxa: 4.2 },
    arquivo: 'custo-por-departamento-2026-10',
};

describe('CSV', () => {
    it('abre com acentuação correta: UTF-8 com BOM, ponto e vírgula, vírgula decimal e CRLF', () => {
        const csv = gerarCsv(tabela);
        assert.deepEqual([...csv.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
        assert.equal(csv.toString('utf8').startsWith(BOM), true);
        const linhas = csv.toString('utf8').slice(1).split('\r\n');
        assert.deepEqual(linhas, [
            'Departamento;Colaboradores;Bruto (R$);Taxa (%)',
            'Gestão e Pessoas;2;1234,50;12,5',
            'Tecnologia;1;3000,00;0,0',
            'Total;3;4234,50;4,2',
            '',
        ]);
        // Os bytes de "ã" e "ç" em UTF-8, não em Latin-1.
        assert.ok(csv.includes(Buffer.from('Gestão', 'utf8')));
    });

    it('protege o texto: aspas e separadores são escapados e o que começa como fórmula vira texto', () => {
        const csv = gerarCsv({
            ...tabela,
            linhas: [{ departamento: 'Vendas; "Sul"', colaboradores: 1, bruto: 1, taxa: 0 }, { departamento: '=HYPERLINK("http://x")', colaboradores: 1, bruto: 1, taxa: 0 }, { departamento: '+55 91', colaboradores: 1, bruto: 1, taxa: 0 }, { departamento: '@SUM(A1)', colaboradores: 1, bruto: 1, taxa: 0 }, { departamento: '-2+3', colaboradores: 1, bruto: 1, taxa: 0 }],
            total: null,
        }).toString('utf8');
        assert.match(csv, /"Vendas; ""Sul"""/);
        assert.match(csv, /\r\n"'=HYPERLINK\(""http:\/\/x""\)";1;/);
        assert.match(csv, /\r\n'\+55 91;1;/);
        assert.match(csv, /\r\n'@SUM\(A1\);1;/);
        assert.match(csv, /\r\n'-2\+3;1;/);
    });

    it('sem linhas nem total sai só o cabeçalho', () => {
        assert.equal(gerarCsv({ ...tabela, linhas: [], total: null }).toString('utf8'), `${BOM}Departamento;Colaboradores;Bruto (R$);Taxa (%)\r\n`);
    });
});

describe('formatação de leitura', () => {
    it('escreve moeda, inteiro e percentual como o brasileiro lê', () => {
        assert.equal(formatarParaLeitura(1234.5, 'moeda').replace(/\s/g, ' '), 'R$ 1.234,50');
        assert.equal(formatarParaLeitura(12345, 'inteiro'), '12.345');
        assert.equal(formatarParaLeitura(12.5, 'percentual'), '12,5%');
        assert.equal(formatarParaLeitura('texto', 'moeda'), 'texto');
    });
});

describe('PDF', () => {
    it('é um PDF com o cabeçalho, as linhas e o total formatados', async () => {
        const pdf = await gerarPdf(tabela);
        assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
        const textos = textosDoPdf(pdf);
        for (const esperado of ['HRFlow', 'Custo por departamento', 'Empresa Açaí Ltda · Competência 10/2026 · folha fechada', 'Gestão e Pessoas', 'Tecnologia', 'Total', 'R$ 1.234,50', 'R$ 4.234,50', '12,5%', 'Gerado em 02/10/2026 14:30', 'Página 1 de 1']) {
            assert.ok(textos.includes(esperado), `${esperado} não está em ${JSON.stringify(textos)}`);
        }
    });

    it('uma tabela longa passa para a página seguinte, repete o cabeçalho e numera as páginas', async () => {
        const linhas = Array.from({ length: 80 }, (_, i) => ({ departamento: `Departamento ${i + 1}`, colaboradores: i, bruto: i * 10, taxa: 0 }));
        const textos = textosDoPdf(await gerarPdf({ ...tabela, linhas }));
        assert.ok(textos.includes('Departamento 80'));
        assert.ok(textos.includes('Página 1 de 3'), JSON.stringify(textos.filter((t) => t.startsWith('Página'))));
        assert.ok(textos.includes('Página 3 de 3'));
        assert.ok(textos.filter((t) => t === 'Departamento').length >= 3, 'o cabeçalho da tabela se repete em cada página');
    });

    it('sem registros diz isso, em vez de uma tabela vazia', async () => {
        const textos = textosDoPdf(await gerarPdf({ ...tabela, linhas: [], total: null }));
        assert.ok(textos.includes('Nenhum registro neste período.'));
    });

    it('muitas colunas deitam a página', async () => {
        const colunas = Array.from({ length: 7 }, (_, i) => ({ chave: `c${i}`, rotulo: `Coluna ${i}`, tipo: 'inteiro' as const }));
        const pdf = await gerarPdf({ ...tabela, colunas, linhas: [], total: null });
        // A MediaBox da página deitada tem a largura maior que a altura.
        const [, largura, altura] = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdf.toString('latin1'))!.map(Number);
        assert.ok(largura > altura);
    });
});
