// Regras dos relatórios: de onde vem cada número (cadastro, folha, ponto) e como ele vira JSON e tabela
// exportável. Não conhece HTTP (falhas de regra saem como ErroDeRelatorio) e só chega ao banco pelos
// repositórios e pelos serviços das outras áreas.
import { agoraEmSegundos } from '../../shared/utils/fuso.ts';
import { buscarEmpresa, fusoDaEmpresa } from '../empresa/index.ts';
import { consultarFolha, ErroDeFolha } from '../folha/index.ts';
import { apurarMesDaEmpresa } from '../ponto/index.ts';
import * as regras from './relatorios.regras.ts';
import * as repositorio from './relatorios.repository.ts';
import { ErroDeRelatorio } from './relatorios.erros.ts';
import type { ConsultaDeAbsenteismo, ConsultaDeAniversariantes, ConsultaDeCusto, ConsultaDeHeadcount } from './relatorios.schemas.ts';
import type { Tabela } from './relatorios.tabela.ts';

// O relatório pronto: `dados` é o que a tela consome (JSON) e `tabela`, o que o CSV e o PDF imprimem.
export interface Relatorio<T> {
    dados: T;
    tabela: Tabela;
}

// 'AAAA-MM' como 'MM/AAAA', o jeito que o relatório escreve o mês.
const rotuloDoMes = (mes: string): string => `${mes.slice(5)}/${mes.slice(0, 4)}`;

// 'DD/MM/AAAA HH:MM' no fuso da empresa.
const instanteDaGeracao = (fuso: Awaited<ReturnType<typeof fusoDaEmpresa>>): string => {
    const agora = agoraEmSegundos();
    return `${fuso.diaLocal(agora).split('-').reverse().join('/')} ${fuso.horaLocal(agora).slice(0, 5)}`;
};

// O cabeçalho que todo relatório leva: a empresa (a razão social quando há) e quando foi gerado.
const cabecalho = async (empresaId: number) => {
    const [empresa, fuso] = await Promise.all([buscarEmpresa(empresaId), fusoDaEmpresa(empresaId)]);
    return { empresa: empresa.razao_social ?? empresa.nome, geradoEm: instanteDaGeracao(fuso), fuso };
};

export const headcount = async ({ empresaId, consulta }: { empresaId: number; consulta: Pick<ConsultaDeHeadcount, 'de' | 'ate'> }): Promise<Relatorio<regras.LinhaDeHeadcount[]>> => {
    const { de, ate } = consulta;
    const meses = regras.mesesEntre(de, ate);
    if (meses.length === 0) throw new ErroDeRelatorio('invalido', 'O mês inicial (de) não pode ser depois do mês final (ate).');
    if (meses.length > regras.MAXIMO_DE_MESES) {
        throw new ErroDeRelatorio('invalido', `O período pode ter no máximo ${regras.MAXIMO_DE_MESES} meses.`);
    }

    const primeiroDia = regras.primeiroDiaDoMes(de);
    const ultimoDia = regras.ultimoDiaDoMes(ate);
    const [ativosAntes, admitidosPorMes, desligadosPorMes, cab] = await Promise.all([
        repositorio.ativosAntesDe(empresaId, primeiroDia),
        repositorio.admissoesPorMes(empresaId, primeiroDia, ultimoDia),
        repositorio.desligamentosPorMes(empresaId, primeiroDia, ultimoDia),
        cabecalho(empresaId),
    ]);

    const dados = regras.montarHeadcount({ meses, ativosAntes, admitidosPorMes, desligadosPorMes });
    return {
        dados,
        tabela: {
            titulo: 'Headcount e turnover',
            subtitulo: `${rotuloDoMes(de)} a ${rotuloDoMes(ate)}`,
            empresa: cab.empresa,
            geradoEm: cab.geradoEm,
            colunas: [
                { chave: 'mes', rotulo: 'Mês', tipo: 'texto' },
                { chave: 'admitidos', rotulo: 'Admitidos', tipo: 'inteiro' },
                { chave: 'desligados', rotulo: 'Desligados', tipo: 'inteiro' },
                { chave: 'ativos', rotulo: 'Ativos no fim do mês', tipo: 'inteiro' },
                { chave: 'turnover', rotulo: 'Turnover', tipo: 'percentual' },
            ],
            linhas: dados.map((linha) => ({ ...linha, mes: rotuloDoMes(linha.mes) })),
            total: {
                mes: 'Total',
                admitidos: dados.reduce((soma, linha) => soma + linha.admitidos, 0),
                desligados: dados.reduce((soma, linha) => soma + linha.desligados, 0),
                ativos: dados[dados.length - 1].ativos,
                turnover: regras.percentual(
                    dados.reduce((soma, linha) => soma + linha.desligados, 0),
                    (ativosAntes + dados[dados.length - 1].ativos) / 2
                ),
            },
            arquivo: `headcount-${de}-a-${ate}`,
        },
    };
};

export interface AniversarianteDoMes {
    funcionarioId: number;
    nome: string;
    departamento: string | null;
    cargo: string | null;
    dia: number;
}

export const aniversariantes = async ({ empresaId, consulta }: { empresaId: number; consulta: Pick<ConsultaDeAniversariantes, 'mes'> }): Promise<Relatorio<AniversarianteDoMes[]>> => {
    const cab = await cabecalho(empresaId);
    const mes = consulta.mes ?? cab.fuso.mesLocal(agoraEmSegundos());
    const linhas = await repositorio.aniversariantesDoMes(empresaId, Number(mes.slice(5)));
    const dados = linhas.map(({ id, nome, departamento, cargo, dia }) => ({ funcionarioId: id, nome, departamento, cargo, dia }));
    return {
        dados,
        tabela: {
            titulo: 'Aniversariantes do mês',
            subtitulo: rotuloDoMes(mes),
            empresa: cab.empresa,
            geradoEm: cab.geradoEm,
            colunas: [
                { chave: 'dia', rotulo: 'Dia', tipo: 'inteiro' },
                { chave: 'nome', rotulo: 'Colaborador', tipo: 'texto' },
                { chave: 'departamento', rotulo: 'Departamento', tipo: 'texto' },
                { chave: 'cargo', rotulo: 'Cargo', tipo: 'texto' },
            ],
            linhas: dados.map((linha) => ({ ...linha, departamento: linha.departamento ?? '', cargo: linha.cargo ?? '' })),
            total: null,
            arquivo: `aniversariantes-${mes}`,
        },
    };
};

export interface CustoPorDepartamento {
    competencia: string;
    // 'aberta' é a prévia do processamento; só a 'fechada' é definitiva.
    statusDaFolha: 'aberta' | 'fechada';
    departamentos: regras.LinhaDeCusto[];
    total: regras.LinhaDeCusto;
}

// A mesma folha que a tela de folha mostra, somada por departamento: o total é, por construção, o da folha.
export const custoPorDepartamento = async ({ empresaId, consulta }: { empresaId: number; consulta: Pick<ConsultaDeCusto, 'competencia'> }): Promise<Relatorio<CustoPorDepartamento>> => {
    const { competencia } = consulta;
    const [folha, cab] = await Promise.all([
        consultarFolha({ empresaId, competencia }).catch((erro: unknown) => {
            if (erro instanceof ErroDeFolha && erro.tipo === 'inexistente') throw new ErroDeRelatorio('inexistente', erro.message);
            throw erro;
        }),
        cabecalho(empresaId),
    ]);

    const { linhas, total } = regras.custoPorDepartamento(folha.itens);
    return {
        dados: { competencia, statusDaFolha: folha.status, departamentos: linhas, total },
        tabela: {
            titulo: 'Custo por departamento',
            subtitulo: `Competência ${rotuloDoMes(competencia)} · folha ${folha.status === 'fechada' ? 'fechada' : 'aberta (prévia, ainda pode mudar)'}`,
            empresa: cab.empresa,
            geradoEm: cab.geradoEm,
            colunas: [
                { chave: 'departamento', rotulo: 'Departamento', tipo: 'texto' },
                { chave: 'colaboradores', rotulo: 'Colaboradores', tipo: 'inteiro' },
                { chave: 'bruto', rotulo: 'Bruto', tipo: 'moeda' },
                { chave: 'descontos', rotulo: 'Descontos', tipo: 'moeda' },
                { chave: 'liquido', rotulo: 'Líquido', tipo: 'moeda' },
                { chave: 'encargos', rotulo: 'Encargos', tipo: 'moeda' },
                { chave: 'custoTotal', rotulo: 'Custo total', tipo: 'moeda' },
            ],
            linhas: linhas.map((linha) => ({ ...linha })),
            total: { ...total },
            arquivo: `custo-por-departamento-${competencia}`,
        },
    };
};

export interface AbsenteismoDoMes {
    mes: string;
    departamentos: regras.LinhaDeAbsenteismo[];
    total: regras.LinhaDeAbsenteismo;
}

export const absenteismo = async ({ empresaId, consulta }: { empresaId: number; consulta: Pick<ConsultaDeAbsenteismo, 'mes'> }): Promise<Relatorio<AbsenteismoDoMes>> => {
    const { mes } = consulta;
    const [colaboradores, cab] = await Promise.all([apurarMesDaEmpresa({ empresaId, mes }), cabecalho(empresaId)]);
    const { linhas, total } = regras.absenteismoPorDepartamento(colaboradores);
    return {
        dados: { mes, departamentos: linhas, total },
        tabela: {
            titulo: 'Absenteísmo',
            subtitulo: `${rotuloDoMes(mes)} · dias úteis já apurados`,
            empresa: cab.empresa,
            geradoEm: cab.geradoEm,
            colunas: [
                { chave: 'departamento', rotulo: 'Departamento', tipo: 'texto' },
                { chave: 'colaboradores', rotulo: 'Colaboradores', tipo: 'inteiro' },
                { chave: 'diasApurados', rotulo: 'Dias apurados', tipo: 'inteiro' },
                { chave: 'faltas', rotulo: 'Faltas', tipo: 'inteiro' },
                { chave: 'ausenciasJustificadas', rotulo: 'Justificadas', tipo: 'inteiro' },
                { chave: 'atrasos', rotulo: 'Atrasos', tipo: 'inteiro' },
                { chave: 'taxa', rotulo: 'Taxa', tipo: 'percentual' },
            ],
            linhas: linhas.map((linha) => ({ ...linha })),
            total: { ...total },
            arquivo: `absenteismo-${mes}`,
        },
    };
};
