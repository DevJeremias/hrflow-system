// Regras da folha por competência: quem entra, o cálculo de cada colaborador (folha.regras.ts), o
// processamento que pode se repetir enquanto a folha está aberta e o fechamento que a trava. Não
// conhece HTTP (falhas de regra saem como ErroDeFolha) e só chega ao banco pelo repositório.
import { relogio, diaLocal } from '../ponto/index.ts';
import { competenciaDoDia, primeiroDia, ultimoDia, rotuloDaCompetencia } from './folha.competencia.ts';
import { CODIGO_SALARIO, calcularHolerite, emCentavos, emReais, haTabelaVigente, rubricasDoHolerite } from './folha.regras.ts';
import * as repositorio from './folha.repository.ts';
import type { ColaboradorDaFolha, DadosDaEmpresa, FolhaGravada, ItemGravado, NovoItem, Pendencia, StatusDaFolha } from './folha.repository.ts';
import { ErroDeFolha } from './folha.erros.ts';

export { relogio };

const NAO_DEFINIDO = 'Não definido';
const MOTIVO_SEM_SALARIO = 'Salário base não informado';

// Formato que o front-end consome (frontend/src/services/payrollService.ts).
export interface HoleriteDoColaborador {
    id: string;
    name: string;
    role: string;
    department: string;
    contract: string | null;
    baseSalary: number;
    totalEarnings: number;
    totalDeductions: number;
    totalGross: number;
    netSalary: number;
    employerCharges: number;
    earningsList: { description: string; value: number; isPercentage: boolean }[];
    deductionsList: { description: string; value: number; isPercentage: boolean }[];
}

export interface EmpresaDoHolerite {
    razaoSocial: string | null;
    cnpj: string | null;
}

export interface HoleritePublicado extends HoleriteDoColaborador {
    competencia: string;
    empresa: EmpresaDoHolerite;
}

export interface FolhaDaCompetencia {
    competencia: string;
    status: StatusDaFolha;
    processadaEm: string;
    fechadaEm: string | null;
    empresa: EmpresaDoHolerite;
    totais: { bruto: number; descontos: number; liquido: number; encargos: number };
    itens: HoleriteDoColaborador[];
    pendencias: Pendencia[];
}

const paraIso = (segundos: number): string => new Date(segundos * 1000).toISOString();

const hojeEmCompetencia = (): string => competenciaDoDia(diaLocal(Math.floor(relogio.agora() / 1000)));

// A folha só existe para um mês que já começou e para o qual há tabela de INSS.
const exigirCompetenciaProcessavel = (competencia: string) => {
    if (competencia > hojeEmCompetencia()) {
        throw new ErroDeFolha('invalido', `A competência ${rotuloDaCompetencia(competencia)} ainda não começou: não é possível processar a folha.`);
    }
    if (!haTabelaVigente(primeiroDia(competencia))) {
        throw new ErroDeFolha('invalido', `Não há tabela de INSS para a competência ${rotuloDaCompetencia(competencia)}.`);
    }
};

const valorDe = (decimal: string): number => Number(decimal);

const holeriteDe = (item: ItemGravado): HoleriteDoColaborador => {
    const proventos = item.rubricas.filter((rubrica) => rubrica.tipo === 'provento');
    const descontos = item.rubricas.filter((rubrica) => rubrica.tipo === 'desconto');
    const extras = proventos.filter((rubrica) => rubrica.codigo !== CODIGO_SALARIO);
    const emLista = (rubricas: typeof proventos) => rubricas.map((rubrica) => ({ description: rubrica.descricao, value: rubrica.valor, isPercentage: false }));
    const soma = (rubricas: typeof proventos) => emReais(rubricas.reduce((total, rubrica) => total + emCentavos(rubrica.valor), 0));
    return {
        id: item.funcionario_id.toString(),
        name: item.nome,
        role: item.cargo || NAO_DEFINIDO,
        department: item.departamento || NAO_DEFINIDO,
        contract: item.tipo_contrato,
        baseSalary: valorDe(item.bruto),
        totalEarnings: soma(extras),
        totalDeductions: soma(descontos),
        totalGross: soma(proventos),
        netSalary: valorDe(item.liquido),
        employerCharges: valorDe(item.encargos),
        earningsList: emLista(extras),
        deductionsList: emLista(descontos),
    };
};

const empresaDe = (dados: { razao_social: string | null; cnpj: string | null }): EmpresaDoHolerite => ({
    razaoSocial: dados.razao_social,
    cnpj: dados.cnpj,
});

const montarFolha = (folha: FolhaGravada, itens: ItemGravado[]): FolhaDaCompetencia => {
    const holerites = itens.map(holeriteDe);
    const somar = (campo: 'totalGross' | 'totalDeductions' | 'netSalary' | 'employerCharges') =>
        emReais(holerites.reduce((total, holerite) => total + emCentavos(holerite[campo]), 0));
    return {
        competencia: folha.competencia,
        status: folha.status,
        processadaEm: paraIso(folha.processada_em),
        fechadaEm: folha.fechada_em === null ? null : paraIso(folha.fechada_em),
        empresa: empresaDe(folha),
        totais: { bruto: somar('totalGross'), descontos: somar('totalDeductions'), liquido: somar('netSalary'), encargos: somar('employerCharges') },
        itens: holerites,
        pendencias: folha.pendencias,
    };
};

// Separa quem entra na folha de quem fica pendente. Salário ausente ou zero não vira holerite de
// R$ 0,00: o colaborador aparece nas pendências até alguém cadastrar o salário.
const apurar = (colaboradores: ColaboradorDaFolha[], competencia: string): { itens: NovoItem[]; pendencias: Pendencia[] } => {
    const itens: NovoItem[] = [];
    const pendencias: Pendencia[] = [];
    for (const colaborador of colaboradores) {
        const salario = parseFloat(colaborador.salario_base ?? '');
        if (!(salario > 0)) {
            pendencias.push({ funcionarioId: colaborador.id, nome: colaborador.nome, motivo: MOTIVO_SEM_SALARIO });
            continue;
        }
        const holerite = calcularHolerite(salario, primeiroDia(competencia), undefined, colaborador.tipo_contrato);
        itens.push({
            funcionarioId: colaborador.id,
            nome: colaborador.nome,
            cargo: colaborador.cargo_nome,
            departamento: colaborador.departamento_nome,
            tipoContrato: colaborador.tipo_contrato,
            bruto: holerite.baseSalary,
            inss: holerite.inss,
            liquido: holerite.netSalary,
            encargos: holerite.employerCharges,
            rubricas: rubricasDoHolerite(holerite),
        });
    }
    return { itens, pendencias };
};

const dadosDaEmpresa = async (repo: repositorio.RepositorioDaFolha, empresaId: number): Promise<DadosDaEmpresa> => {
    const empresa = await repo.dadosDaEmpresa(empresaId);
    if (!empresa) throw new Error(`Empresa ${empresaId} do token não existe.`);
    return empresa;
};

const folhaOuErro = async (empresaId: number, competencia: string): Promise<FolhaGravada> => {
    const folha = await repositorio.folhaDaCompetencia(empresaId, competencia);
    if (!folha) throw new ErroDeFolha('inexistente', `A folha de ${rotuloDaCompetencia(competencia)} ainda não foi processada.`);
    return folha;
};

export const consultarFolha = async ({ empresaId, competencia }: { empresaId: number; competencia: string }): Promise<FolhaDaCompetencia> => {
    const folha = await folhaOuErro(empresaId, competencia);
    return montarFolha(folha, await repositorio.itensDaFolha(folha.id));
};

// Cria a folha da competência ou, estando ela aberta, a recalcula com os dados de agora.
export const processarFolha = async ({ empresaId, competencia }: { empresaId: number; competencia: string }): Promise<{ folha: FolhaDaCompetencia; criada: boolean }> => {
    exigirCompetenciaProcessavel(competencia);
    const { criada, folhaId } = await repositorio.emTransacao(async (repo) => {
        const criada = await repo.criarFolhaSeNaoExiste(empresaId, competencia);
        const folha = (await repo.travarFolha(empresaId, competencia))!;
        if (folha.status === 'fechada') {
            throw new ErroDeFolha('conflito', `A folha de ${rotuloDaCompetencia(competencia)} está fechada e não pode ser processada de novo.`);
        }
        const { itens, pendencias } = apurar(await repo.colaboradoresDaCompetencia(empresaId, primeiroDia(competencia), ultimoDia(competencia)), competencia);
        await repo.gravarProcessamento(folha.id, empresaId, itens, pendencias, await dadosDaEmpresa(repo, empresaId));
        return { criada, folhaId: folha.id };
    });
    const folha = (await repositorio.folhaDaCompetencia(empresaId, competencia))!;
    return { folha: montarFolha(folha, await repositorio.itensDaFolha(folhaId)), criada };
};

// Trava a folha. O que foi conferido é o que fecha: o fechamento não recalcula nada, só registra
// quem fechou e congela a razão social e o CNPJ da empresa neste momento.
export const fecharFolha = async ({ empresaId, usuarioId, competencia }: { empresaId: number; usuarioId: number; competencia: string }): Promise<FolhaDaCompetencia> => {
    const folhaId = await repositorio.emTransacao(async (repo) => {
        const folha = await repo.travarFolha(empresaId, competencia);
        if (!folha) throw new ErroDeFolha('inexistente', `A folha de ${rotuloDaCompetencia(competencia)} ainda não foi processada.`);
        if (folha.status === 'fechada') throw new ErroDeFolha('conflito', `A folha de ${rotuloDaCompetencia(competencia)} já está fechada.`);
        const empresa = await dadosDaEmpresa(repo, empresaId);
        if (!empresa.razao_social || !empresa.cnpj) {
            throw new ErroDeFolha('incompleto', 'Preencha a razão social e o CNPJ da empresa antes de fechar a folha: eles aparecem no holerite.');
        }
        await repo.fecharFolha(folha.id, usuarioId, empresa);
        return folha.id;
    });
    return montarFolha((await repositorio.folhaDaCompetencia(empresaId, competencia))!, await repositorio.itensDaFolha(folhaId));
};

const publicado = (item: repositorio.HoleritePublicado): HoleritePublicado => ({
    ...holeriteDe(item),
    competencia: item.competencia,
    empresa: empresaDe(item),
});

// O colaborador é quem o token diz, pelo vínculo usuário/funcionário; só vê folhas já fechadas.
const funcionarioOuErro = async (usuarioId: number, empresaId: number): Promise<number> => {
    const funcionarioId = await repositorio.funcionarioDoUsuario(usuarioId, empresaId);
    if (funcionarioId === undefined) throw new ErroDeFolha('inexistente', 'Colaborador não encontrado');
    return funcionarioId;
};

export const meuHolerite = async ({ usuarioId, empresaId, competencia }: { usuarioId: number; empresaId: number; competencia: string }): Promise<HoleritePublicado> => {
    const funcionarioId = await funcionarioOuErro(usuarioId, empresaId);
    const [holerite] = await repositorio.holeritesFechados(funcionarioId, empresaId, competencia);
    if (!holerite) throw new ErroDeFolha('inexistente', `Não há holerite fechado para a competência ${rotuloDaCompetencia(competencia)}.`);
    return publicado(holerite);
};

export const meusHolerites = async ({ usuarioId, empresaId }: { usuarioId: number; empresaId: number }): Promise<HoleritePublicado[]> => {
    const funcionarioId = await funcionarioOuErro(usuarioId, empresaId);
    return (await repositorio.holeritesFechados(funcionarioId, empresaId, null)).map(publicado);
};
