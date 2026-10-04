// Regras do fluxo de férias e afastamentos: o colaborador pede, o RH decide, e o período aprovado
// vale na situação do colaborador e na folha. Não conhece HTTP (falhas de regra saem como
// ErroDeAusencia) e só chega ao banco pelo repositório.
import { relogio, agoraEmSegundos } from '../../shared/utils/fuso.ts';
import type { Fuso } from '../../shared/utils/fuso.ts';
import { fusoDaEmpresa } from '../empresa/index.ts';
import { notificarColaboradores } from '../notificacoes/index.ts';
import * as regras from './ausencias.regras.ts';
import type { SaldoDeFerias, StatusDeAusencia, TipoDeAusencia } from './ausencias.regras.ts';
import * as repositorio from './ausencias.repository.ts';
import type { AusenciaDaEmpresa } from './ausencias.repository.ts';
import { ErroDeAusencia } from './ausencias.erros.ts';
import type { ConsultaDeAusencias, CorpoDaSolicitacao, DecisaoRecebida } from './ausencias.schemas.ts';
import { perfilTem } from '../../shared/utils/permissoes.ts';
import { limiteEDeslocamento } from '../../shared/utils/paginacao.ts';

export { relogio };

// O "hoje" do pedido, da situação e do saldo é o dia no fuso da empresa: o mesmo relógio do ponto.
export const hojeDaEmpresa = async (empresaId: number): Promise<string> => (await fusoDaEmpresa(empresaId)).diaLocal(agoraEmSegundos());

const paraIso = (segundos: number): string => new Date(segundos * 1000).toISOString();

// Formato que o front-end consome (frontend/src/services/requestService.ts).
export interface Ausencia {
    id: number;
    employeeId: number;
    employeeName: string;
    type: TipoDeAusencia;
    requestDate: string;
    startDate: string;
    endDate: string;
    days: number;
    observation: string;
    hasAttachment: boolean;
    attachmentName: string | null;
    status: StatusDeAusencia;
    reply: string | null;
    decidedBy: string | null;
    decidedAt: string | null;
}

export interface AusenciaDaFila extends Ausencia {
    // O ator pode decidir este pedido agora; a lista do RH esconde os botões quando não.
    canDecide: boolean;
}

const paraAusencia = (linha: AusenciaDaEmpresa, fuso: Fuso): Ausencia => ({
    id: linha.id,
    employeeId: linha.funcionario_id,
    employeeName: linha.nome_funcionario,
    type: linha.tipo,
    requestDate: fuso.diaLocal(linha.criado),
    startDate: linha.inicio,
    endDate: linha.fim,
    days: regras.diasCorridos(linha.inicio, linha.fim),
    observation: linha.observacao,
    hasAttachment: linha.anexo_nome !== null,
    attachmentName: linha.anexo_nome,
    status: linha.status,
    reply: linha.resposta,
    decidedBy: linha.decidido_por_nome,
    decidedAt: linha.decidido === null ? null : paraIso(linha.decidido),
});

export interface DadosDaSolicitacao {
    empresaId: number;
    funcionarioId: number | null;
    corpo: CorpoDaSolicitacao;
}

const exigirVinculo = (funcionarioId: number | null, acao: string): number => {
    if (!funcionarioId) throw new ErroDeAusencia('proibido', `Acesso negado. Apenas colaboradores vinculados podem ${acao}.`);
    return funcionarioId;
};

// O colaborador e a empresa vêm do token, nunca do corpo. O pedido nasce Pendente; férias só passam
// se o saldo do colaborador cobre os dias, e nenhum pedido pode cobrir dias que outro, em análise
// ou aprovado, já ocupa.
export const solicitar = async ({ empresaId, funcionarioId, corpo }: DadosDaSolicitacao): Promise<Ausencia> => {
    const colaboradorId = exigirVinculo(funcionarioId, 'solicitar férias ou afastamentos');
    const { tipo, inicio, fim, observacao, anexo } = corpo;

    const motivo = regras.motivoDeRecusaDoPedido({ tipo, inicio, fim, anexado: anexo !== null }, await hojeDaEmpresa(empresaId));
    if (motivo) throw new ErroDeAusencia('invalido', motivo);

    const id = await repositorio.emTransacao(async (repo) => {
        const colaborador = await repo.colaborador(colaboradorId, empresaId, { travar: true });
        if (!colaborador) throw new ErroDeAusencia('inexistente', 'Colaborador não encontrado nesta empresa.');

        if ((await repo.periodosEmAberto(colaboradorId)).some((periodo) => regras.sobrepoe(periodo, { inicio, fim }))) {
            throw new ErroDeAusencia('conflito', 'Já existe uma solicitação em análise ou aprovada que cobre parte deste período.');
        }

        if (tipo === 'Férias') {
            if (colaborador.admissao === null) {
                throw new ErroDeAusencia('conflito', 'A data de admissão não está cadastrada, então o saldo de férias não pode ser calculado. Peça ao RH para preenchê-la.');
            }
            const saldo = regras.calcularSaldo(colaborador.admissao, inicio, await repo.feriasPedidas(colaboradorId));
            const dias = regras.diasCorridos(inicio, fim);
            if (dias > saldo.saldo) {
                throw new ErroDeAusencia('conflito', `Saldo de férias insuficiente: a solicitação tem ${dias} dias e há ${saldo.saldo} disponíveis em ${inicio.split('-').reverse().join('/')}.`, { saldo });
            }
        }

        const criada = await repo.inserir({ empresaId, funcionarioId: colaboradorId, tipo, inicio, fim, observacao });
        if (anexo) await repo.inserirAnexo({ ausenciaId: criada, empresaId, nome: anexo.nome, tipo: anexo.tipo, conteudo: anexo.conteudo });
        return criada;
    });
    return paraAusencia((await repositorio.ausenciaDaEmpresa(id, empresaId))!, await fusoDaEmpresa(empresaId));
};

export const listarMinhas = async ({ empresaId, funcionarioId }: { empresaId: number; funcionarioId: number | null }): Promise<Ausencia[]> => {
    const colaboradorId = exigirVinculo(funcionarioId, 'consultar as próprias solicitações');
    const fuso = await fusoDaEmpresa(empresaId);
    return (await repositorio.ausenciasDoColaborador(colaboradorId, empresaId)).map((linha) => paraAusencia(linha, fuso));
};

export interface Ator {
    perfil: string;
    funcionarioId: number | null;
}

// Por que o ator não decide o pedido, ou null. Ninguém decide o próprio pedido, e o RH não decide o
// de quem tem acesso de RH ou Administrador: o alcance dele é o dos cadastros (shared/utils/permissoes.ts).
const motivoDeNaoDecidir = (ator: Ator, pedido: { funcionario_id: number; perfil_da_conta: string | null }): string | null => {
    if (ator.funcionarioId !== null && ator.funcionarioId === pedido.funcionario_id) return 'Você não pode decidir a sua própria solicitação.';
    if (ator.perfil !== 'Administrador' && (pedido.perfil_da_conta === 'RH' || pedido.perfil_da_conta === 'Administrador')) {
        return 'Só um Administrador decide a solicitação de quem tem acesso de RH ou Administrador.';
    }
    return null;
};

export const listarDaEmpresa = async ({ empresaId, ator, consulta }: { empresaId: number; ator: Ator; consulta: ConsultaDeAusencias }): Promise<{ ausencias: AusenciaDaFila[]; total: number }> => {
    const { status, funcionarioId, ...paginacao } = consulta;
    const [limite, deslocamento] = limiteEDeslocamento(paginacao);
    const [linhas, total] = await Promise.all([
        repositorio.ausenciasDaEmpresa({ empresaId, status, funcionarioId, limite, deslocamento }),
        repositorio.contarDaEmpresa({ empresaId, status, funcionarioId }),
    ]);
    const fuso = await fusoDaEmpresa(empresaId);
    const ausencias = linhas.map((linha) => ({
        ...paraAusencia(linha, fuso),
        canDecide: linha.status === 'Pendente' && motivoDeNaoDecidir(ator, linha) === null,
    }));
    return { ausencias, total };
};

export interface DadosDaDecisao extends DecisaoRecebida {
    empresaId: number;
    id: number;
    // Quem decide: o usuário, o perfil e o colaborador a que ele está vinculado, se houver.
    usuarioId: number;
    ator: Ator;
}

// Só um pedido em análise é decidido; a decisão é registrada com quem a tomou e vale na hora.
export const decidir = async ({ empresaId, id, status, resposta, usuarioId, ator }: DadosDaDecisao): Promise<Ausencia> => {
    if (status === 'Recusada' && !resposta) throw new ErroDeAusencia('invalido', 'Informe o motivo da recusa para o colaborador.');

    await repositorio.emTransacao(async (repo) => {
        const travada = await repo.travarAusencia(id, empresaId);
        if (!travada) throw new ErroDeAusencia('inexistente', 'Solicitação não encontrada.');
        if (travada.status !== 'Pendente') throw new ErroDeAusencia('conflito', 'Esta solicitação já foi decidida.');

        const pedido = (await repo.ausenciaDaEmpresa(id, empresaId))!;
        const motivo = motivoDeNaoDecidir(ator, pedido);
        if (motivo) throw new ErroDeAusencia('proibido', motivo);

        await repo.decidir({ id, empresaId, status, resposta, decididoPor: usuarioId });
    });
    const decidida = paraAusencia((await repositorio.ausenciaDaEmpresa(id, empresaId))!, await fusoDaEmpresa(empresaId));
    await avisarDecisao(empresaId, decidida);
    return decidida;
};

const dataPorExtenso = (dia: string): string => dia.split('-').reverse().join('/');

// O colaborador fica sabendo da decisão no sino (e por e-mail, se configurado), com o motivo da recusa.
const avisarDecisao = (empresaId: number, { employeeId, type, startDate, endDate, status, reply }: Ausencia): Promise<void> => {
    const aprovada = status === 'Aprovada';
    const periodo = `${dataPorExtenso(startDate)} a ${dataPorExtenso(endDate)}`;
    return notificarColaboradores(empresaId, [employeeId], {
        tipo: 'ausencia',
        titulo: `${type} ${aprovada ? 'aprovada' : 'recusada'}`,
        mensagem: `A sua solicitação de ${type.toLowerCase()} de ${periodo} foi ${aprovada ? 'aprovada' : 'recusada'}.${reply ? ` Resposta do RH: ${reply}` : ''}`,
        link: '/meu-painel/solicitacoes',
    });
};

// O saldo é o do colaborador consultado, que a rota já autorizou; a empresa vem do token.
export const saldoDoColaborador = async ({ empresaId, funcionarioId }: { empresaId: number; funcionarioId: number }): Promise<SaldoDeFerias> => {
    const colaborador = await repositorio.colaborador(funcionarioId, empresaId);
    if (!colaborador) throw new ErroDeAusencia('inexistente', 'Colaborador não encontrado nesta empresa.');
    return regras.calcularSaldo(colaborador.admissao, await hojeDaEmpresa(empresaId), await repositorio.feriasPedidas(funcionarioId));
};

export interface ArquivoAnexado {
    nome: string;
    tipo: string;
    conteudo: Buffer;
}

// O anexo é do colaborador que pediu e de quem gere ausências na empresa; para qualquer outro
// colaborador a rota responde como se ele não existisse.
export const anexoDaAusencia = async ({ empresaId, id, ator }: { empresaId: number; id: number; ator: Ator }): Promise<ArquivoAnexado> => {
    const anexo = await repositorio.anexoDaAusencia(id, empresaId);
    if (!anexo || (!perfilTem(ator.perfil, 'ausencias:gerir') && anexo.funcionario_id !== ator.funcionarioId)) {
        throw new ErroDeAusencia('inexistente', 'Anexo não encontrado.');
    }
    return { nome: anexo.nome, tipo: anexo.tipo_mime, conteudo: anexo.conteudo };
};

export interface PeriodoAprovado {
    tipo: TipoDeAusencia;
    inicio: string;
    fim: string;
}

// As ausências aprovadas que tocam [de, ate], por colaborador: a folha e a apuração do ponto as leem.
export const ausenciasAprovadasNoPeriodo = async (empresaId: number, de: string, ate: string): Promise<Map<number, PeriodoAprovado[]>> => {
    const porColaborador = new Map<number, PeriodoAprovado[]>();
    for (const { funcionario_id: id, tipo, inicio, fim } of await repositorio.aprovadasNoPeriodo(empresaId, de, ate)) {
        porColaborador.set(id, [...(porColaborador.get(id) ?? []), { tipo, inicio, fim }]);
    }
    return porColaborador;
};

// Dias de férias aprovadas de cada colaborador dentro de [de, ate], para o terço de férias da folha.
export const diasDeFeriasNoPeriodo = (ausencias: ReadonlyMap<number, readonly PeriodoAprovado[]>, funcionarioId: number, de: string, ate: string): number =>
    (ausencias.get(funcionarioId) ?? []).filter((a) => a.tipo === 'Férias').reduce((total, a) => total + regras.diasNoIntervalo(a.inicio, a.fim, de, ate), 0);
