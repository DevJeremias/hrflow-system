// Regras da folha por competência: quem entra, o cálculo de cada colaborador (folha.regras.ts), o
// processamento que pode se repetir enquanto a folha está aberta e o fechamento que a trava. Não
// conhece HTTP (falhas de regra saem como ErroDeFolha) e só chega ao banco pelo repositório.
import { relogio, agoraEmSegundos } from '../../shared/utils/fuso.ts';
import { fusoDaEmpresa } from '../empresa/index.ts';
import { notificarColaboradores } from '../notificacoes/index.ts';
import { apurarDiasDoMes } from '../ponto/index.ts';
import { competenciaDoDia, primeiroDia, proximoMes, ultimoDia, rotuloDaCompetencia } from './folha.competencia.ts';
import { CODIGO_SALARIO, SEM_LANCAMENTOS, calcularHolerite, emCentavos, emReais, haTabelaDeIrrfVigente, haTabelaVigente } from './folha.regras.ts';
import type { Lancamentos, RegimeTributario, Rubrica } from './folha.regras.ts';
import { eventosDoPonto } from './folha.ponto.ts';
import * as repositorio from './folha.repository.ts';
import type { ColaboradorDaFolha, DadosDaEmpresa, FolhaGravada, ItemGravado, JustificativaDoMes, MarcacaoDoMes, NovoItem, Pendencia, StatusDaFolha } from './folha.repository.ts';
import { ErroDeFolha } from './folha.erros.ts';
import type { Autoria } from '../../shared/utils/auditar.ts';

export { relogio };

const NAO_DEFINIDO = 'Não definido';
const MOTIVO_SEM_SALARIO = 'Salário base não informado';
const MOTIVO_DESCONTOS_ACIMA_DOS_PROVENTOS = 'Os descontos superam os proventos do mês';

export interface LinhaDoHolerite {
    description: string;
    value: number;
    isPercentage: boolean;
    // O texto da coluna de referência: dias, horas, alíquota.
    reference: string | null;
}

// Formato que o front-end consome (frontend/src/services/payrollService.ts). `earningsList` não
// repete o salário base, que vem em `baseSalary`; `chargesList` é o que a empresa paga além do salário
// (FGTS e contribuições patronais), que não sai do líquido.
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
    inss: number;
    irrf: number;
    fgts: number;
    dependents: number;
    // Nulas nos holerites emitidos antes do IRRF.
    bases: { inss: number; fgts: number; irrf: number } | null;
    lancamentos: Lancamentos;
    earningsList: LinhaDoHolerite[];
    deductionsList: LinhaDoHolerite[];
    chargesList: LinhaDoHolerite[];
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
    // O regime que valeu nos encargos; nulo quando a empresa não o informou (vale a regra geral).
    regimeTributario: RegimeTributario | null;
    totais: { bruto: number; descontos: number; liquido: number; encargos: number; inss: number; irrf: number; fgts: number };
    itens: HoleriteDoColaborador[];
    pendencias: Pendencia[];
}

const paraIso = (segundos: number): string => new Date(segundos * 1000).toISOString();

const hojeEmCompetencia = async (empresaId: number): Promise<string> => competenciaDoDia((await fusoDaEmpresa(empresaId)).diaLocal(agoraEmSegundos()));

// A folha só existe para um mês que já começou e para o qual há tabela de INSS e de IRRF.
const exigirCompetenciaProcessavel = async (empresaId: number, competencia: string) => {
    if (competencia > await hojeEmCompetencia(empresaId)) {
        throw new ErroDeFolha('invalido', `A competência ${rotuloDaCompetencia(competencia)} ainda não começou: não é possível processar a folha.`);
    }
    if (!haTabelaVigente(primeiroDia(competencia))) {
        throw new ErroDeFolha('invalido', `Não há tabela de INSS para a competência ${rotuloDaCompetencia(competencia)}.`);
    }
    if (!haTabelaDeIrrfVigente(primeiroDia(competencia))) {
        throw new ErroDeFolha('invalido', `Não há tabela de IRRF para a competência ${rotuloDaCompetencia(competencia)}.`);
    }
};

const valorDe = (decimal: string): number => Number(decimal);

const emLista = (rubricas: Rubrica[]): LinhaDoHolerite[] =>
    rubricas.map((rubrica) => ({ description: rubrica.descricao, value: rubrica.valor, isPercentage: false, reference: rubrica.referencia ?? null }));

const somaDe = (rubricas: Rubrica[]): number => emReais(rubricas.reduce((total, rubrica) => total + emCentavos(rubrica.valor), 0));

const holeriteDe = (item: ItemGravado): HoleriteDoColaborador => {
    const proventos = item.rubricas.filter((rubrica) => rubrica.tipo === 'provento');
    const descontos = item.rubricas.filter((rubrica) => rubrica.tipo === 'desconto');
    const encargos = item.rubricas.filter((rubrica) => rubrica.tipo === 'encargo');
    const extras = proventos.filter((rubrica) => rubrica.codigo !== CODIGO_SALARIO);
    return {
        id: item.funcionario_id.toString(),
        name: item.nome,
        role: item.cargo || NAO_DEFINIDO,
        department: item.departamento || NAO_DEFINIDO,
        contract: item.tipo_contrato,
        baseSalary: valorDe(item.bruto),
        totalEarnings: somaDe(extras),
        totalDeductions: somaDe(descontos),
        totalGross: somaDe(proventos),
        netSalary: valorDe(item.liquido),
        employerCharges: valorDe(item.encargos),
        inss: valorDe(item.inss),
        irrf: valorDe(item.irrf),
        fgts: valorDe(item.fgts),
        dependents: item.dependentes,
        bases: item.bases,
        lancamentos: item.lancamentos ?? SEM_LANCAMENTOS,
        earningsList: emLista(extras),
        deductionsList: emLista(descontos),
        chargesList: emLista(encargos),
    };
};

const empresaDe = (dados: { razao_social: string | null; cnpj: string | null }): EmpresaDoHolerite => ({
    razaoSocial: dados.razao_social,
    cnpj: dados.cnpj,
});

const montarFolha = (folha: FolhaGravada, itens: ItemGravado[]): FolhaDaCompetencia => {
    const holerites = itens.map(holeriteDe);
    const somar = (campo: 'totalGross' | 'totalDeductions' | 'netSalary' | 'employerCharges' | 'inss' | 'irrf' | 'fgts') =>
        emReais(holerites.reduce((total, holerite) => total + emCentavos(holerite[campo]), 0));
    return {
        competencia: folha.competencia,
        status: folha.status,
        processadaEm: paraIso(folha.processada_em),
        fechadaEm: folha.fechada_em === null ? null : paraIso(folha.fechada_em),
        empresa: empresaDe(folha),
        regimeTributario: folha.regime_tributario,
        totais: {
            bruto: somar('totalGross'), descontos: somar('totalDeductions'), liquido: somar('netSalary'), encargos: somar('employerCharges'),
            inss: somar('inss'), irrf: somar('irrf'), fgts: somar('fgts'),
        },
        itens: holerites,
        pendencias: folha.pendencias,
    };
};

const agruparPorColaborador = <T extends { funcionario_id: number }>(linhas: readonly T[]): Map<number, T[]> => {
    const grupos = new Map<number, T[]>();
    for (const linha of linhas) grupos.set(linha.funcionario_id, [...(grupos.get(linha.funcionario_id) ?? []), linha]);
    return grupos;
};

// O que a folha precisa saber do ponto de cada colaborador no mês, lido de uma vez para a empresa
// (ou para um colaborador): a apuração é a de modules/ponto, a mesma que a tela de ponto mostra.
const carregarPonto = async (repo: repositorio.RepositorioDaFolha, empresaId: number, competencia: string, funcionarioId: number | null) => {
    // O dia do ponto, e portanto o mês da apuração, é o do fuso da empresa.
    const fuso = await fusoDaEmpresa(empresaId);
    const { inicio, fim } = fuso.limitesDoMes(competencia);
    const [marcacoes, justificativas] = await Promise.all([
        repo.marcacoesDoMes(empresaId, inicio, fim, funcionarioId),
        repo.justificativasDoMes(empresaId, primeiroDia(competencia), proximoMes(competencia), funcionarioId),
    ]);
    return { fuso, marcacoes: agruparPorColaborador<MarcacaoDoMes>(marcacoes), justificativas: agruparPorColaborador<JustificativaDoMes>(justificativas) };
};

type PontoDoMes = Awaited<ReturnType<typeof carregarPonto>>;

// Separa quem entra na folha de quem fica pendente. Salário ausente ou zero não vira holerite de
// R$ 0,00: o colaborador aparece nas pendências até alguém cadastrar o salário, e descontos que
// superam os proventos também não viram holerite negativo.
const apurar = (
    colaboradores: ColaboradorDaFolha[],
    competencia: string,
    regime: RegimeTributario | null,
    ponto: PontoDoMes,
    lancamentosDe: ReadonlyMap<number, Lancamentos>,
): { itens: NovoItem[]; pendencias: Pendencia[] } => {
    const itens: NovoItem[] = [];
    const pendencias: Pendencia[] = [];
    for (const colaborador of colaboradores) {
        const salario = parseFloat(colaborador.salario_base ?? '');
        if (!(salario > 0)) {
            pendencias.push({ funcionarioId: colaborador.id, nome: colaborador.nome, motivo: MOTIVO_SEM_SALARIO });
            continue;
        }
        const { dias } = apurarDiasDoMes(ponto.fuso, competencia, colaborador, ponto.marcacoes.get(colaborador.id) ?? [], ponto.justificativas.get(colaborador.id) ?? []);
        const lancamentos = lancamentosDe.get(colaborador.id) ?? SEM_LANCAMENTOS;
        const holerite = calcularHolerite({
            salario,
            dia: primeiroDia(competencia),
            tipoContrato: colaborador.tipo_contrato,
            regime,
            dependentes: colaborador.dependentes,
            cargaSemanalHoras: Number(colaborador.carga_semanal),
            ponto: eventosDoPonto(dias, colaborador.desligamento).eventos,
            lancamentos,
        });
        if (holerite.netSalary < 0) {
            pendencias.push({ funcionarioId: colaborador.id, nome: colaborador.nome, motivo: MOTIVO_DESCONTOS_ACIMA_DOS_PROVENTOS });
            continue;
        }
        itens.push({
            funcionarioId: colaborador.id,
            nome: colaborador.nome,
            cargo: colaborador.cargo_nome,
            departamento: colaborador.departamento_nome,
            tipoContrato: colaborador.tipo_contrato,
            bruto: holerite.baseSalary,
            inss: holerite.inss,
            irrf: holerite.irrf,
            liquido: holerite.netSalary,
            encargos: holerite.employerCharges,
            fgts: holerite.fgts,
            dependentes: colaborador.dependentes,
            bases: holerite.bases,
            lancamentos,
            rubricas: holerite.rubricas,
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
export const processarFolha = async ({ empresaId, competencia, autoria }: { empresaId: number; competencia: string; autoria: Autoria }): Promise<{ folha: FolhaDaCompetencia; criada: boolean }> => {
    await exigirCompetenciaProcessavel(empresaId, competencia);
    const { criada, folhaId } = await repositorio.emTransacao(async (repo) => {
        const criada = await repo.criarFolhaSeNaoExiste(empresaId, competencia);
        const folha = (await repo.travarFolha(empresaId, competencia))!;
        if (folha.status === 'fechada') {
            throw new ErroDeFolha('conflito', `A folha de ${rotuloDaCompetencia(competencia)} está fechada e não pode ser processada de novo.`);
        }
        const empresa = await dadosDaEmpresa(repo, empresaId);
        const colaboradores = await repo.colaboradoresDaCompetencia(empresaId, primeiroDia(competencia), ultimoDia(competencia));
        // Reprocessar parte do que o RH já lançou em cada colaborador.
        const { itens, pendencias } = apurar(colaboradores, competencia, empresa.regime_tributario, await carregarPonto(repo, empresaId, competencia, null), await repo.lancamentosDaFolha(folha.id));
        await repo.gravarProcessamento(folha.id, empresaId, itens, pendencias, empresa);
        await repo.auditar(autoria, {
            acao: 'folha.processada',
            entidade: 'folha',
            entidadeId: folha.id,
            depois: { competencia, criada, colaboradores: itens.length, pendencias: pendencias.length },
        });
        return { criada, folhaId: folha.id };
    });
    const folha = (await repositorio.folhaDaCompetencia(empresaId, competencia))!;
    return { folha: montarFolha(folha, await repositorio.itensDaFolha(folhaId)), criada };
};

// Trava a folha. O que foi conferido é o que fecha: o fechamento não recalcula nada, só registra
// quem fechou e congela a razão social e o CNPJ da empresa neste momento.
export const fecharFolha = async ({ empresaId, usuarioId, competencia, autoria }: { empresaId: number; usuarioId: number; competencia: string; autoria: Autoria }): Promise<FolhaDaCompetencia> => {
    const folhaId = await repositorio.emTransacao(async (repo) => {
        const folha = await repo.travarFolha(empresaId, competencia);
        if (!folha) throw new ErroDeFolha('inexistente', `A folha de ${rotuloDaCompetencia(competencia)} ainda não foi processada.`);
        if (folha.status === 'fechada') throw new ErroDeFolha('conflito', `A folha de ${rotuloDaCompetencia(competencia)} já está fechada.`);
        const empresa = await dadosDaEmpresa(repo, empresaId);
        if (!empresa.razao_social || !empresa.cnpj) {
            throw new ErroDeFolha('incompleto', 'Preencha a razão social e o CNPJ da empresa antes de fechar a folha: eles aparecem no holerite.');
        }
        await repo.fecharFolha(folha.id, usuarioId, empresa);
        await repo.auditar(autoria, { acao: 'folha.fechada', entidade: 'folha', entidadeId: folha.id, depois: { competencia } });
        return folha.id;
    });
    const fechada = montarFolha((await repositorio.folhaDaCompetencia(empresaId, competencia))!, await repositorio.itensDaFolha(folhaId));
    // O holerite só aparece para o colaborador com a folha fechada: é quando ele é avisado.
    await notificarColaboradores(empresaId, fechada.itens.map((item) => Number(item.id)), {
        tipo: 'holerite',
        titulo: `Holerite de ${rotuloDaCompetencia(competencia)} disponível`,
        mensagem: `O seu holerite da competência ${rotuloDaCompetencia(competencia)} já pode ser consultado.`,
        link: '/meu-painel/holerites',
    });
    return fechada;
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

// Substitui os lançamentos de um colaborador na folha aberta e recalcula só o holerite dele. Os
// valores que não vierem são zero: o que o RH não informa deixa de ser lançado.
export const lancarEventos = async ({ empresaId, competencia, funcionarioId, lancamentos, autoria }: { empresaId: number; competencia: string; funcionarioId: number; lancamentos: Lancamentos; autoria: Autoria }): Promise<HoleriteDoColaborador> => {
    await repositorio.emTransacao(async (repo) => {
        const folha = await repo.travarFolha(empresaId, competencia);
        if (!folha) throw new ErroDeFolha('inexistente', `A folha de ${rotuloDaCompetencia(competencia)} ainda não foi processada.`);
        if (folha.status === 'fechada') {
            throw new ErroDeFolha('conflito', `A folha de ${rotuloDaCompetencia(competencia)} está fechada: os lançamentos não podem mais mudar.`);
        }
        if ((await repo.itensDaFolha(folha.id, funcionarioId)).length === 0) {
            throw new ErroDeFolha('inexistente', 'Este colaborador não tem holerite na folha. Corrija o cadastro e processe a folha de novo.');
        }
        const colaboradores = await repo.colaboradoresDaCompetencia(empresaId, primeiroDia(competencia), ultimoDia(competencia), funcionarioId);
        const ponto = await carregarPonto(repo, empresaId, competencia, funcionarioId);
        const { itens, pendencias } = apurar(colaboradores, competencia, folha.regime_tributario, ponto, new Map([[funcionarioId, lancamentos]]));
        if (itens.length === 0) {
            throw new ErroDeFolha('invalido', `Não foi possível calcular o holerite: ${pendencias[0]?.motivo.toLowerCase() ?? 'colaborador fora da folha'}.`);
        }
        const anteriores = (await repo.lancamentosDaFolha(folha.id)).get(funcionarioId) ?? null;
        await repo.substituirItem(folha.id, empresaId, itens[0]);
        await repo.auditar(autoria, {
            acao: 'folha.lancamentos_alterados', entidade: 'folha', entidadeId: folha.id, funcionarioId,
            antes: { competencia, lancamentos: anteriores }, depois: { competencia, lancamentos },
        });
    });
    const folha = await folhaOuErro(empresaId, competencia);
    return holeriteDe((await repositorio.itensDaFolha(folha.id, funcionarioId))[0]);
};

// O que o PDF imprime: uma página por holerite, com a empresa e a competência da folha.
export interface DadosDoPdf {
    competencia: string;
    status: StatusDaFolha;
    empresa: EmpresaDoHolerite;
    holerites: HoleriteDoColaborador[];
}

// Os holerites da folha, de todos os colaboradores ou só de um, para o RH imprimir. A folha aberta
// também sai, marcada como em conferência no PDF.
export const holeritesParaPdf = async ({ empresaId, competencia, funcionarioId }: { empresaId: number; competencia: string; funcionarioId: number | null }): Promise<DadosDoPdf> => {
    const folha = await consultarFolha({ empresaId, competencia });
    const holerites = funcionarioId === null ? folha.itens : folha.itens.filter((item) => item.id === String(funcionarioId));
    if (holerites.length === 0) {
        throw new ErroDeFolha('inexistente', funcionarioId === null
            ? `A folha de ${rotuloDaCompetencia(competencia)} não tem holerites para imprimir.`
            : `Este colaborador não tem holerite na folha de ${rotuloDaCompetencia(competencia)}.`);
    }
    return { competencia, status: folha.status, empresa: folha.empresa, holerites };
};

export const meuHoleritePdf = async (consulta: { usuarioId: number; empresaId: number; competencia: string }): Promise<DadosDoPdf> => {
    const holerite = await meuHolerite(consulta);
    return { competencia: holerite.competencia, status: 'fechada', empresa: holerite.empresa, holerites: [holerite] };
};
