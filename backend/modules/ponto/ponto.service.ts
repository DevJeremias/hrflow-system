// Regras do ponto: quem pode marcar, em que sequência, o que cada dia mostra. Não conhece HTTP
// (falhas de regra saem como ErroDePonto) e só chega ao banco pelo repositório.
import * as fuso from './ponto.fuso.ts';
import * as regras from './ponto.regras.ts';
import type { TipoRegistro, Validacao } from './ponto.regras.ts';
import * as repositorio from './ponto.repository.ts';
import { ErroDePonto } from './ponto.erros.ts';
import type { ConsultaDePontosDaEmpresa } from './ponto.schemas.ts';

// Relógio do servidor em ms, trocável nos testes para fixar "agora" perto da virada do dia em Belém.
export const relogio = { agora: (): number => Date.now() };
const agoraEmSegundos = (): number => Math.floor(relogio.agora() / 1000);

const intervaloDoDia = (segundos: number): fuso.Intervalo => fuso.limitesDoDia(fuso.diaLocal(segundos));

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

export interface DiaDoHistorico {
    id: string;
    date: string;
    entry: string;
    lunchOut: string;
    lunchIn: string;
    exit: string;
    totalHours: string;
    status: string;
    note: string;
    negativeAdjust: string;
    positiveAdjust: string;
}

export interface Justificativa {
    id: number;
    funcionario_id: number;
    nome_funcionario: string;
    date: string;
    note: string;
    createdAt: string;
    updatedAt: string;
}

const montarRegistro = (id: number, tipo: TipoRegistro, segundos: number): RegistroMarcado => ({
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

    const agora = agoraEmSegundos();
    const { inicio, fim } = intervaloDoDia(agora);

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

    return montarRegistro(id, tipo, agora);
};

export interface ConsultaDoColaborador {
    empresaId: number;
    funcionarioId: string;
}

// A autorização do colaborador consultado já foi decidida na rota; a empresa continua vindo do token.
export const listarPontosHoje = async ({ empresaId, funcionarioId }: ConsultaDoColaborador): Promise<RegistroMarcado[]> => {
    const { inicio, fim } = intervaloDoDia(agoraEmSegundos());
    const pontos = await repositorio.registrosDoPeriodo(funcionarioId, empresaId, inicio, fim);
    return pontos.map((p) => montarRegistro(p.id, p.tipo_registro, p.instante));
};

export const listarHistorico = async ({ empresaId, funcionarioId, mes }: ConsultaDoColaborador & { mes: unknown }): Promise<DiaDoHistorico[]> => {
    if (!fuso.mesValido(mes)) {
        throw new ErroDePonto('invalido', 'Informe o mês no formato AAAA-MM (ex.: 2026-03).');
    }
    const { inicio, fim } = fuso.limitesDoMes(mes);
    const { de, ate } = datasDoMes(mes);

    const pontos = await repositorio.registrosDoPeriodo(funcionarioId, empresaId, inicio, fim);
    const justificativas = await repositorio.justificativasDoColaborador(funcionarioId, empresaId, de, ate);
    const justificativaDoDia = new Map(justificativas.map((j) => [j.dia, j.texto]));

    const dias: Record<string, DiaDoHistorico> = {};

    justificativas.forEach((j) => {
        dias[j.dia] = {
            id: j.dia, date: j.dia, entry: '--:--', lunchOut: '--:--', lunchIn: '--:--', exit: '--:--',
            totalHours: '--:--', status: 'OK', note: j.texto, negativeAdjust: '00:00', positiveAdjust: '00:00'
        };
    });

    pontos.forEach(p => {
        const dataStr = fuso.diaLocal(p.instante);
        const horaStr = fuso.horaLocal(p.instante).slice(0, 5);

        if (!dias[dataStr]) {
            dias[dataStr] = {
                id: dataStr, date: dataStr, entry: '--:--', lunchOut: '--:--', lunchIn: '--:--', exit: '--:--',
                totalHours: '--:--', status: 'OK', note: justificativaDoDia.get(dataStr) ?? (p.observacao || ''), negativeAdjust: '00:00', positiveAdjust: '00:00'
            };
        }

        if (p.tipo_registro === 'Entrada') dias[dataStr].entry = horaStr;
        else if (p.tipo_registro === 'Pausa Almoço') dias[dataStr].lunchOut = horaStr;
        else if (p.tipo_registro === 'Retorno Almoço') dias[dataStr].lunchIn = horaStr;
        else if (p.tipo_registro === 'Saída') dias[dataStr].exit = horaStr;
    });

    return Object.values(dias);
};

// Ainda sem cálculo: devolve a estrutura que a tela espera com os valores em branco.
export const listarTotais = () => ({
    totals: [
        { id: 'w1', weekLabel: 'Semana Atual', workloadLimit: '44:00', workloadPreset: '44:00', workloadDone: '--:--', presenceTime: '--:--', pendingTime: '--:--', excessTime: '--:--', hoursBank: '--:--', dailyAdjustBalance: '--:--' }
    ],
    monthlySummary: { workloadLimit: '220:00', workloadPreset: '220:00', workloadDone: '--:--', presenceTime: '--:--', pendingTime: '--:--', excessTime: '--:--', hoursBank: '--:--', dailyAdjustBalance: '--:--' }
});

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

// Uma página das marcações do mês de Belém, da mais recente à mais antiga, e o total do mês.
export const listarPontosDaEmpresa = async ({ empresaId, consulta }: { empresaId: number; consulta: ConsultaDePontosDaEmpresa }): Promise<{ registros: PontoDaEmpresa[]; total: number }> => {
    const { mes, funcionarioId, busca, pagina, limite } = consulta;
    const { pontos, total } = await repositorio.registrosDaEmpresa({
        empresaId, ...fuso.limitesDoMes(mes), funcionarioId, busca, limite, deslocamento: (pagina - 1) * limite,
    });

    // data_hora_oficial segue como instante ISO em UTC; date e time são o relógio de Belém.
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

// O colaborador e a empresa vêm do token: o corpo e a URL só dizem o dia e o texto.
export const enviarJustificativa = async ({ empresaId, funcionarioId, data, texto }: DadosDaJustificativa): Promise<Pick<Justificativa, 'date' | 'note' | 'updatedAt'>> => {
    if (!funcionarioId) {
        throw new ErroDePonto('proibido', 'Acesso negado. Apenas colaboradores vinculados podem justificar o ponto.');
    }
    if (!await repositorio.colaboradorExiste(funcionarioId, empresaId)) {
        throw new ErroDePonto('inexistente', 'Colaborador não encontrado nesta empresa.');
    }

    await repositorio.salvarJustificativa({ empresaId, funcionarioId, data, texto });
    const atualizadoEm = await repositorio.instanteDaJustificativa(funcionarioId, data);
    return { date: data, note: texto, updatedAt: paraIso(atualizadoEm) };
};

export const listarJustificativas = async ({ empresaId, mes, funcionarioId }: { empresaId: number; mes: string; funcionarioId: number | null }): Promise<Justificativa[]> => {
    const { de, ate } = datasDoMes(mes);
    const linhas = await repositorio.justificativasDaEmpresa({ empresaId, de, ate, funcionarioId });

    return linhas.map(({ criado, atualizado, ...j }) => ({
        ...j,
        createdAt: paraIso(criado),
        updatedAt: paraIso(atualizado),
    }));
};
