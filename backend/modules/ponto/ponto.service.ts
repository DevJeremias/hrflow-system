// Regras do ponto: quem pode marcar, em que sequência, o que cada dia mostra. Não conhece HTTP
// (falhas de regra saem como ErroDePonto) e só chega ao banco pelo repositório.
import { agoraEmSegundos, mesValido } from '../../shared/utils/fuso.ts';
import type { Fuso } from '../../shared/utils/fuso.ts';
import { fusoDaEmpresa } from '../empresa/index.ts';
import { notificarColaboradores } from '../notificacoes/index.ts';
import * as regras from './ponto.regras.ts';
import type { DecisaoDaJustificativa, Jornada, StatusDoDia, TipoRegistro, Validacao } from './ponto.regras.ts';
import * as repositorio from './ponto.repository.ts';
import { ErroDePonto } from './ponto.erros.ts';
import type { ConsultaDePontosDaEmpresa, ConsultaDeJustificativas, DecisaoRecebida } from './ponto.schemas.ts';
import type { Autoria } from '../../shared/utils/auditar.ts';

export { relogio } from '../../shared/utils/fuso.ts';

const intervaloDoDia = (fuso: Fuso, segundos: number) => fuso.limitesDoDia(fuso.diaLocal(segundos));

// Primeiro dia do mês seguinte a 'AAAA-MM', como 'AAAA-MM-01'.
const proximoMes = (mes: string): string => {
    const [ano, m] = mes.split('-').map(Number);
    return m === 12 ? `${ano + 1}-01-01` : `${ano}-${String(m + 1).padStart(2, '0')}-01`;
};

// Datas de referência [de, ate) do mês 'AAAA-MM', como as colunas DATE das justificativas.
const datasDoMes = (mes: string): { de: string; ate: string } => ({ de: `${mes}-01`, ate: proximoMes(mes) });

const paraIso = (segundos: number): string => new Date(segundos * 1000).toISOString();

// Devolve os dados aceitos pela validação ou recusa a requisição com a mensagem dela.
const exigir = <T>(validacao: Validacao<T>): T => {
    if ('erro' in validacao) throw new ErroDePonto('invalido', validacao.erro);
    return validacao.dados;
};

// Formatos que o front-end consome (frontend/src/services).
export interface RegistroMarcado {
    id: string;
    type: TipoRegistro;
    time: string;
    date: string;
}

// Um dia do espelho. `open` marca o dia ainda sem apuração (futuro, hoje sem saída ou antes da
// admissão); `delay` e os ajustes são 'HH:MM'. `note` é a justificativa do colaborador e
// `noteStatus` e `noteReply`, o que o RH decidiu sobre ela.
export interface DiaDoHistorico {
    id: string;
    date: string;
    entry: string;
    lunchOut: string;
    lunchIn: string;
    exit: string;
    totalHours: string;
    status: StatusDoDia;
    open: boolean;
    delay: string;
    note: string;
    noteStatus: DecisaoDaJustificativa | null;
    noteReply: string | null;
    negativeAdjust: string;
    positiveAdjust: string;
}

export interface Justificativa {
    id: number;
    funcionario_id: number;
    nome_funcionario: string;
    date: string;
    note: string;
    status: DecisaoDaJustificativa;
    reply: string | null;
    decidedBy: string | null;
    decidedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

const montarRegistro = (fuso: Fuso, id: number, tipo: TipoRegistro, segundos: number): RegistroMarcado => ({
    id: id.toString(),
    type: tipo,
    time: fuso.horaLocal(segundos),
    date: fuso.diaLocal(segundos),
});

export interface DadosDoRegistro {
    empresaId: number;
    funcionarioId: number | null;
    // Corpo da requisição como chegou: quem valida é este serviço.
    corpo: unknown;
}

// O colaborador e a empresa vêm do token, nunca do corpo nem da URL.
export const registrarPonto = async ({ empresaId, funcionarioId, corpo }: DadosDoRegistro): Promise<RegistroMarcado> => {
    if (!funcionarioId) {
        throw new ErroDePonto('proibido', 'Acesso negado. Apenas colaboradores vinculados podem registrar ponto.');
    }

    const entrada = (corpo || {}) as { tipo?: unknown; latitude?: unknown; longitude?: unknown; observacao?: unknown };
    const tipo = exigir(regras.validarTipo(entrada.tipo));
    const { latitude, longitude } = exigir(regras.validarCoordenadas(entrada));
    const observacao = exigir(regras.validarObservacao(entrada.observacao));

    // O "dia" da marcação é o da empresa: uma empresa em Manaus vira o dia uma hora depois da de Belém.
    const fuso = await fusoDaEmpresa(empresaId);
    const agora = agoraEmSegundos();
    const { inicio, fim } = intervaloDoDia(fuso, agora);

    const id = await repositorio.emTransacao(async (repo) => {
        // O bloqueio da linha do colaborador serializa marcações simultâneas (duplo clique, duas
        // abas): sem ele, ambas leem o mesmo último registro e passam na validação da sequência.
        if (!await repo.colaboradorExiste(funcionarioId, empresaId, { travar: true })) {
            throw new ErroDePonto('inexistente', 'Colaborador não encontrado nesta empresa.');
        }

        const ultimo = await repo.ultimoRegistroDoDia(funcionarioId, empresaId, inicio, fim);

        const permitidos = regras.proximosPermitidos(ultimo ? ultimo.tipo_registro : null);
        if (!permitidos.includes(tipo)) {
            const resumo = ultimo
                ? `O último registro de hoje foi "${ultimo.tipo_registro}" às ${fuso.horaLocal(ultimo.instante)}.`
                : 'Ainda não há registros hoje.';
            const proximo = permitidos.length > 0
                ? `Registre ${permitidos.map((t) => `"${t}"`).join(' ou ')}.`
                : 'A jornada de hoje já foi encerrada.';
            throw new ErroDePonto(
                'conflito',
                `Sequência de marcações inválida para "${tipo}". ${resumo} ${proximo}`,
                { proximosPermitidos: permitidos }
            );
        }

        return repo.inserirRegistro({ funcionarioId, empresaId, tipo, latitude, longitude, instante: agora, observacao });
    });

    return montarRegistro(fuso, id, tipo, agora);
};

export interface ConsultaDoColaborador {
    empresaId: number;
    funcionarioId: string;
}

// A autorização do colaborador consultado já foi decidida na rota; a empresa continua vindo do token.
export const listarPontosHoje = async ({ empresaId, funcionarioId }: ConsultaDoColaborador): Promise<RegistroMarcado[]> => {
    const fuso = await fusoDaEmpresa(empresaId);
    const { inicio, fim } = intervaloDoDia(fuso, agoraEmSegundos());
    const pontos = await repositorio.registrosDoPeriodo(funcionarioId, empresaId, inicio, fim);
    return pontos.map((p) => montarRegistro(fuso, p.id, p.tipo_registro, p.instante));
};

const minutoDoDia = (fuso: Fuso, segundos: number): number => {
    const [horas, minutos] = fuso.horaLocal(segundos).split(':').map(Number);
    return horas * 60 + minutos;
};

// Cada dia 'AAAA-MM-DD' do mês 'AAAA-MM', do primeiro ao último.
const diasDoMes = (mes: string): string[] => {
    const [ano, m] = mes.split('-').map(Number);
    const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
    return Array.from({ length: ultimo }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
};

interface JornadaDoMes extends Jornada {
    cargaSemanalHoras: number;
    entrada: string;
    saida: string;
}

// O que a apuração precisa do colaborador: a jornada e a admissão, como o repositório as devolve.
export type JornadaParaApurar = Pick<repositorio.JornadaDoColaborador, 'carga_semanal' | 'entrada' | 'saida' | 'entrada_min' | 'tolerancia_min' | 'admissao'>;

// Apura cada dia do mês 'AAAA-MM' do colaborador a partir das marcações e justificativas já lidas, inclusive os
// dias sem marcação, no fuso da empresa. É a única apuração do sistema: a tela de ponto, a folha e os
// relatórios a usam.
export const apurarDiasDoMes = (
    fuso: Fuso,
    mes: string,
    registro: JornadaParaApurar,
    pontos: readonly Pick<repositorio.RegistroDoColaborador, 'tipo_registro' | 'instante'>[],
    justificativas: readonly Pick<repositorio.JustificativaDoDia, 'dia' | 'status'>[],
    // Férias e afastamentos aprovados (modules/ausencias): os dias úteis deles são abonados como uma
    // justificativa aprovada, não são falta.
    ausencias: readonly { inicio: string; fim: string }[] = [],
) => {
    const cargaSemanalHoras = Number(registro.carga_semanal);
    const jornada: JornadaDoMes = {
        cargaSemanalHoras,
        entrada: registro.entrada,
        saida: registro.saida,
        entradaMin: registro.entrada_min,
        toleranciaMin: registro.tolerancia_min,
        cargaDiariaMin: regras.cargaDiariaMin(cargaSemanalHoras),
    };

    const marcacoesDoDia = new Map<string, regras.Marcacao[]>();
    for (const p of pontos) {
        const dia = fuso.diaLocal(p.instante);
        marcacoesDoDia.set(dia, [...(marcacoesDoDia.get(dia) ?? []), { tipo: p.tipo_registro, minuto: minutoDoDia(fuso, p.instante) }]);
    }
    const justificativaDoDia = new Map(justificativas.map((j) => [j.dia, j]));
    const emAusencia = (data: string): boolean => !regras.ehFimDeSemana(data) && ausencias.some((a) => a.inicio <= data && data <= a.fim);

    const dias = regras.apurarMes(
        diasDoMes(mes).map((data) => ({
            data,
            marcacoes: marcacoesDoDia.get(data) ?? [],
            justificativa: justificativaDoDia.get(data)?.status ?? (emAusencia(data) ? 'aprovada' : null),
        })),
        jornada,
        { hoje: fuso.diaLocal(agoraEmSegundos()), admissao: registro.admissao }
    );
    return { dias, jornada };
};

// Lê o mês inteiro do colaborador e apura cada dia.
const apurarOMes = async ({ empresaId, funcionarioId, mes }: ConsultaDoColaborador & { mes: unknown }) => {
    if (!mesValido(mes)) {
        throw new ErroDePonto('invalido', 'Informe o mês no formato AAAA-MM (ex.: 2026-03).');
    }
    const fuso = await fusoDaEmpresa(empresaId);
    const { inicio, fim } = fuso.limitesDoMes(mes);
    const { de, ate } = datasDoMes(mes);

    const [registro, pontos, justificativas, ausencias] = await Promise.all([
        repositorio.jornadaDoColaborador(funcionarioId, empresaId),
        repositorio.registrosDoPeriodo(funcionarioId, empresaId, inicio, fim),
        repositorio.justificativasDoColaborador(funcionarioId, empresaId, de, ate),
        repositorio.ausenciasAprovadasDoColaborador(funcionarioId, empresaId, de, ate),
    ]);
    if (!registro) throw new ErroDePonto('inexistente', 'Colaborador não encontrado nesta empresa.');

    return { ...apurarDiasDoMes(fuso, mes, registro, pontos, justificativas, ausencias), justificativaDoDia: new Map(justificativas.map((j) => [j.dia, j])) };
};

export interface ColaboradorApurado {
    funcionarioId: number;
    nome: string;
    departamento: string | null;
    dias: regras.DiaApurado[];
}

// O mês de todos os colaboradores da empresa, apurado com a mesma regra da tela do colaborador, para os
// relatórios. Três consultas pela empresa inteira em vez de três por colaborador. O dia depois do
// desligamento não é do colaborador e sai da apuração.
export const apurarMesDaEmpresa = async ({ empresaId, mes }: { empresaId: number; mes: string }): Promise<ColaboradorApurado[]> => {
    const fuso = await fusoDaEmpresa(empresaId);
    const { inicio, fim } = fuso.limitesDoMes(mes);
    const { de, ate } = datasDoMes(mes);

    const [colaboradores, pontos, justificativas, ausencias] = await Promise.all([
        repositorio.colaboradoresParaApurar(empresaId, de, `${mes}-${String(diasDoMes(mes).length).padStart(2, '0')}`),
        repositorio.registrosDoMesDaEmpresa(empresaId, inicio, fim),
        repositorio.justificativasDoMesDaEmpresa(empresaId, de, ate),
        repositorio.ausenciasAprovadasDaEmpresa(empresaId, de, ate),
    ]);

    const agrupar = <T extends { funcionario_id: number }>(linhas: T[]): Map<number, T[]> => {
        const porColaborador = new Map<number, T[]>();
        for (const linha of linhas) porColaborador.set(linha.funcionario_id, [...(porColaborador.get(linha.funcionario_id) ?? []), linha]);
        return porColaborador;
    };
    const pontosDe = agrupar(pontos);
    const justificativasDe = agrupar(justificativas);
    const ausenciasDe = agrupar(ausencias);

    return colaboradores.map((colaborador) => {
        const { dias } = apurarDiasDoMes(
            fuso, mes, colaborador,
            pontosDe.get(colaborador.funcionario_id) ?? [],
            justificativasDe.get(colaborador.funcionario_id) ?? [],
            ausenciasDe.get(colaborador.funcionario_id) ?? [],
        );
        // Férias não são ausência a medir: os dias delas saem da apuração (afastamentos seguem como ausência justificada).
        const ferias = (ausenciasDe.get(colaborador.funcionario_id) ?? []).filter((a) => a.tipo === 'Férias');
        const emFerias = (data: string) => ferias.some((a) => a.inicio <= data && data <= a.fim);
        return {
            funcionarioId: colaborador.funcionario_id,
            nome: colaborador.nome,
            departamento: colaborador.departamento,
            dias: dias.filter((dia) => !emFerias(dia.data) && (colaborador.desligamento === null || dia.data <= colaborador.desligamento)),
        };
    });
};

export const listarHistorico = async (consulta: ConsultaDoColaborador & { mes: unknown }): Promise<DiaDoHistorico[]> => {
    const { dias, justificativaDoDia } = await apurarOMes(consulta);
    return dias.map((dia) => {
        const justificativa = justificativaDoDia.get(dia.data);
        return {
            id: dia.data,
            date: dia.data,
            entry: regras.formatarHorario(dia.marcas.entrada),
            lunchOut: regras.formatarHorario(dia.marcas.pausa),
            lunchIn: regras.formatarHorario(dia.marcas.retorno),
            exit: regras.formatarHorario(dia.marcas.saida),
            totalHours: regras.formatarHorario(dia.trabalhadoMin),
            status: dia.statusFinal,
            open: dia.aberto,
            delay: regras.formatarMinutos(dia.atrasoMin),
            note: justificativa?.texto ?? '',
            noteStatus: justificativa?.status ?? null,
            noteReply: justificativa?.resposta ?? null,
            negativeAdjust: regras.formatarMinutos(dia.pendenteMin),
            positiveAdjust: regras.formatarMinutos(dia.excedenteMin),
        };
    });
};

// O que a tela de totais mostra de um período: horas em 'HH:MM', ocorrências em contagem.
export interface TotaisDoPeriodo {
    workloadLimit: string;
    workloadDone: string;
    pendingTime: string;
    excessTime: string;
    delayTime: string;
    absences: number;
    incompleteDays: number;
}

export interface SemanaDoTotal extends TotaisDoPeriodo {
    id: string;
    weekLabel: string;
}

const paraTotais = (totais: regras.Totais): TotaisDoPeriodo => ({
    workloadLimit: regras.formatarMinutos(totais.previstoMin),
    workloadDone: regras.formatarMinutos(totais.trabalhadoMin),
    pendingTime: regras.formatarMinutos(totais.pendenteMin),
    excessTime: regras.formatarMinutos(totais.excedenteMin),
    delayTime: regras.formatarMinutos(totais.atrasoMin),
    absences: totais.faltas,
    incompleteDays: totais.incompletos,
});

const diaEMes = (data: string): string => data.slice(8) + '/' + data.slice(5, 7);

export const listarTotais = async (consulta: ConsultaDoColaborador & { mes: unknown }): Promise<{
    workSchedule: { weeklyHours: number; entry: string; exit: string; toleranceMinutes: number };
    totals: SemanaDoTotal[];
    monthlySummary: TotaisDoPeriodo;
}> => {
    const { dias, jornada } = await apurarOMes(consulta);
    const { semanas, mes } = regras.totalizarMes(dias);
    return {
        workSchedule: { weeklyHours: jornada.cargaSemanalHoras, entry: jornada.entrada, exit: jornada.saida, toleranceMinutes: jornada.toleranciaMin },
        totals: semanas.map(({ de, ate, ...totais }) => ({
            id: de,
            weekLabel: de === ate ? diaEMes(de) : `${diaEMes(de)} a ${diaEMes(ate)}`,
            ...paraTotais(totais),
        })),
        monthlySummary: paraTotais(mes),
    };
};

export interface PontoDaEmpresa {
    id: number;
    funcionario_id: number;
    empresa_id: number;
    tipo_registro: TipoRegistro;
    latitude: string | null;
    longitude: string | null;
    observacao: string | null;
    nome_funcionario: string;
    data_hora_oficial: string;
    date: string;
    time: string;
}

// Uma página das marcações do mês da empresa, da mais recente à mais antiga, e o total do mês.
export const listarPontosDaEmpresa = async ({ empresaId, consulta }: { empresaId: number; consulta: ConsultaDePontosDaEmpresa }): Promise<{ registros: PontoDaEmpresa[]; total: number }> => {
    const { mes, funcionarioId, busca, pagina, limite } = consulta;
    const fuso = await fusoDaEmpresa(empresaId);
    const { pontos, total } = await repositorio.registrosDaEmpresa({
        empresaId, ...fuso.limitesDoMes(mes), funcionarioId, busca, limite, deslocamento: (pagina - 1) * limite,
    });

    // data_hora_oficial segue como instante ISO em UTC; date e time são o relógio da empresa.
    const registros = pontos.map(({ instante, ...p }) => ({
        ...p,
        data_hora_oficial: paraIso(instante),
        date: fuso.diaLocal(instante),
        time: fuso.horaLocal(instante),
    }));
    return { registros, total };
};

export interface DadosDaJustificativa {
    empresaId: number;
    funcionarioId: number | null;
    data: string;
    texto: string;
}

// O colaborador e a empresa vêm do token: o corpo e a URL só dizem o dia e o texto. Uma justificativa
// aprovada fecha o dia; uma recusada pode ser reenviada e volta a ficar pendente para o RH.
export const enviarJustificativa = async ({ empresaId, funcionarioId, data, texto, autoria }: DadosDaJustificativa & { autoria: Autoria }): Promise<Pick<Justificativa, 'date' | 'note' | 'status' | 'updatedAt'>> => {
    if (!funcionarioId) {
        throw new ErroDePonto('proibido', 'Acesso negado. Apenas colaboradores vinculados podem justificar o ponto.');
    }

    if (data > (await fusoDaEmpresa(empresaId)).diaLocal(agoraEmSegundos())) {
        throw new ErroDePonto('invalido', 'Data da justificativa deve estar entre 1900-01-01 e hoje.');
    }

    const atualizadoEm = await repositorio.emTransacao(async (repo) => {
        if (!await repo.colaboradorExiste(funcionarioId, empresaId, { travar: true })) {
            throw new ErroDePonto('inexistente', 'Colaborador não encontrado nesta empresa.');
        }
        if (await repo.statusDaJustificativa(funcionarioId, data, { travar: true }) === 'aprovada') {
            throw new ErroDePonto('conflito', 'O RH já aprovou a justificativa deste dia e ela não pode mais ser alterada.');
        }
        await repo.salvarJustificativa({ empresaId, funcionarioId, data, texto });
        const salva = await repo.instanteDaJustificativa(funcionarioId, data);
        await repo.auditar(autoria, { acao: 'justificativa.enviada', entidade: 'justificativa', entidadeId: salva.id, funcionarioId, depois: { data, texto } });
        return salva.instante;
    });
    return { date: data, note: texto, status: 'pendente', updatedAt: paraIso(atualizadoEm) };
};

const paraJustificativa = ({ criado, atualizado, decidido, decidido_por_nome, resposta, ...j }: repositorio.JustificativaDaEmpresa): Justificativa => ({
    id: j.id,
    funcionario_id: j.funcionario_id,
    nome_funcionario: j.nome_funcionario,
    date: j.date,
    note: j.note,
    status: j.status,
    reply: resposta,
    decidedBy: decidido_por_nome,
    decidedAt: decidido === null ? null : paraIso(decidido),
    createdAt: paraIso(criado),
    updatedAt: paraIso(atualizado),
});

export const listarJustificativas = async ({ empresaId, mes, funcionarioId, status }: { empresaId: number } & ConsultaDeJustificativas): Promise<Justificativa[]> => {
    const { de, ate } = datasDoMes(mes);
    const linhas = await repositorio.justificativasDaEmpresa({ empresaId, de, ate, funcionarioId, status });
    return linhas.map(paraJustificativa);
};

export interface DadosDaDecisao extends DecisaoRecebida {
    empresaId: number;
    id: number;
    // Quem decide: o usuário e o colaborador a que ele está vinculado, se houver.
    usuarioId: number;
    funcionarioIdDoUsuario: number | null;
    autoria: Autoria;
}

// Quem decide vem do token. O RH pode mudar a decisão depois, mas nunca decide a justificativa
// do próprio ponto.
export const decidirJustificativa = async ({ empresaId, id, status, resposta, usuarioId, funcionarioIdDoUsuario, autoria }: DadosDaDecisao): Promise<Justificativa> => {
    const respostaValida = exigir(regras.validarDecisao(status, resposta));
    const decidida = await repositorio.emTransacao(async (repo) => {
        const atual = await repo.justificativaDaEmpresa(id, empresaId, { travar: true });
        if (!atual) throw new ErroDePonto('inexistente', 'Justificativa não encontrada.');
        if (funcionarioIdDoUsuario !== null && atual.funcionario_id === funcionarioIdDoUsuario) {
            throw new ErroDePonto('proibido', 'Você não pode decidir a justificativa do seu próprio ponto.');
        }
        await repo.decidirJustificativa({ id, empresaId, status, resposta: respostaValida, decididoPor: usuarioId });
        await repo.auditar(autoria, {
            acao: 'justificativa.decidida',
            entidade: 'justificativa',
            entidadeId: id,
            funcionarioId: atual.funcionario_id,
            antes: { status: atual.status, resposta: atual.resposta },
            depois: { data: atual.date, status, resposta: respostaValida },
        });
        return paraJustificativa((await repo.justificativaDaEmpresa(id, empresaId))!);
    });
    await avisarDecisao(empresaId, decidida);
    return decidida;
};

const dataPorExtenso = (dia: string): string => dia.split('-').reverse().join('/');

// O colaborador fica sabendo da decisão no sino (e por e-mail, se configurado), com o motivo da recusa.
const avisarDecisao = (empresaId: number, { funcionario_id, date, status, reply }: Justificativa): Promise<void> => {
    const aprovada = status === 'aprovada';
    return notificarColaboradores(empresaId, [funcionario_id], {
        tipo: 'justificativa',
        titulo: aprovada ? 'Justificativa aprovada' : 'Justificativa recusada',
        mensagem: `A sua justificativa do dia ${dataPorExtenso(date)} foi ${aprovada ? 'aprovada' : 'recusada'}.${reply ? ` Resposta do RH: ${reply}` : ''}`,
        link: '/meu-painel',
    });
};
