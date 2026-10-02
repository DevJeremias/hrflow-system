// Regras do ponto: quem pode marcar, em que sequência, o que cada dia mostra. Não conhece HTTP
// (falhas de regra saem como ErroDePonto) e só chega ao banco pelo repositório.
const fuso = require('./ponto.fuso');
const regras = require('./ponto.regras');
const repositorio = require('./ponto.repository');
const { ErroDePonto } = require('./ponto.erros');

// Relógio do servidor em ms, trocável nos testes para fixar "agora" perto da virada do dia em Belém.
const relogio = { agora: () => Date.now() };
const agoraEmSegundos = () => Math.floor(relogio.agora() / 1000);

const intervaloDoDia = (segundos) => fuso.limitesDoDia(fuso.diaLocal(segundos));

// Primeiro dia do mês seguinte a 'AAAA-MM', como 'AAAA-MM-01'.
const proximoMes = (mes) => {
    const [ano, m] = mes.split('-').map(Number);
    return m === 12 ? `${ano + 1}-01-01` : `${ano}-${String(m + 1).padStart(2, '0')}-01`;
};

// Datas de referência [de, ate) do mês 'AAAA-MM', como as colunas DATE das justificativas.
const datasDoMes = (mes) => ({ de: `${mes}-01`, ate: proximoMes(mes) });

const montarRegistro = (id, tipo, segundos) => ({
    id: id.toString(),
    type: tipo,
    time: fuso.horaLocal(segundos),
    date: fuso.diaLocal(segundos),
});

const paraIso = (segundos) => new Date(segundos * 1000).toISOString();

// O colaborador e a empresa vêm do token, nunca do corpo nem da URL.
const registrarPonto = async ({ empresaId, funcionarioId, corpo }) => {
    if (!funcionarioId) {
        throw new ErroDePonto('proibido', 'Acesso negado. Apenas colaboradores vinculados podem registrar ponto.');
    }

    const entrada = corpo || {};
    const tipo = regras.validarTipo(entrada.tipo);
    const coordenadas = regras.validarCoordenadas(entrada);
    const observacao = regras.validarObservacao(entrada.observacao);
    const invalido = [tipo, coordenadas, observacao].find((r) => r.erro);
    if (invalido) throw new ErroDePonto('invalido', invalido.erro);

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
        if (!permitidos.includes(tipo.dados)) {
            const resumo = ultimo
                ? `O último registro de hoje foi "${ultimo.tipo_registro}" às ${fuso.horaLocal(ultimo.instante)}.`
                : 'Ainda não há registros hoje.';
            const proximo = permitidos.length > 0
                ? `Registre ${permitidos.map((t) => `"${t}"`).join(' ou ')}.`
                : 'A jornada de hoje já foi encerrada.';
            throw new ErroDePonto(
                'conflito',
                `Sequência de marcações inválida para "${tipo.dados}". ${resumo} ${proximo}`,
                { proximosPermitidos: permitidos }
            );
        }

        return repo.inserirRegistro({
            funcionarioId,
            empresaId,
            tipo: tipo.dados,
            latitude: coordenadas.dados.latitude,
            longitude: coordenadas.dados.longitude,
            instante: agora,
            observacao: observacao.dados,
        });
    });

    return montarRegistro(id, tipo.dados, agora);
};

// A autorização do colaborador consultado já foi decidida na rota; a empresa continua vindo do token.
const listarPontosHoje = async ({ empresaId, funcionarioId }) => {
    const { inicio, fim } = intervaloDoDia(agoraEmSegundos());
    const pontos = await repositorio.registrosDoPeriodo(funcionarioId, empresaId, inicio, fim);
    return pontos.map((p) => montarRegistro(p.id, p.tipo_registro, p.instante));
};

const listarHistorico = async ({ empresaId, funcionarioId, mes }) => {
    if (!fuso.mesValido(mes)) {
        throw new ErroDePonto('invalido', 'Informe o mês no formato AAAA-MM (ex.: 2026-03).');
    }
    const { inicio, fim } = fuso.limitesDoMes(mes);
    const { de, ate } = datasDoMes(mes);

    const pontos = await repositorio.registrosDoPeriodo(funcionarioId, empresaId, inicio, fim);
    const justificativas = await repositorio.justificativasDoColaborador(funcionarioId, empresaId, de, ate);
    const justificativaDoDia = new Map(justificativas.map((j) => [j.dia, j.texto]));

    const dias = {};

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
const listarTotais = () => ({
    totals: [
        { id: 'w1', weekLabel: 'Semana Atual', workloadLimit: '44:00', workloadPreset: '44:00', workloadDone: '--:--', presenceTime: '--:--', pendingTime: '--:--', excessTime: '--:--', hoursBank: '--:--', dailyAdjustBalance: '--:--' }
    ],
    monthlySummary: { workloadLimit: '220:00', workloadPreset: '220:00', workloadDone: '--:--', presenceTime: '--:--', pendingTime: '--:--', excessTime: '--:--', hoursBank: '--:--', dailyAdjustBalance: '--:--' }
});

const listarPontosDaEmpresa = async ({ empresaId }) => {
    const pontos = await repositorio.registrosDaEmpresa(empresaId);

    // data_hora_oficial segue como instante ISO em UTC; date e time são o relógio de Belém.
    return pontos.map(({ instante, ...p }) => ({
        ...p,
        data_hora_oficial: paraIso(instante),
        date: fuso.diaLocal(instante),
        time: fuso.horaLocal(instante),
    }));
};

// O colaborador e a empresa vêm do token: o corpo e a URL só dizem o dia e o texto.
const enviarJustificativa = async ({ empresaId, funcionarioId, data, texto }) => {
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

const listarJustificativas = async ({ empresaId, mes, funcionarioId }) => {
    const { de, ate } = datasDoMes(mes);
    const linhas = await repositorio.justificativasDaEmpresa({ empresaId, de, ate, funcionarioId });

    return linhas.map(({ criado, atualizado, ...j }) => ({
        ...j,
        createdAt: paraIso(criado),
        updatedAt: paraIso(atualizado),
    }));
};

module.exports = {
    relogio,
    registrarPonto,
    listarPontosHoje,
    listarHistorico,
    listarTotais,
    listarPontosDaEmpresa,
    enviarJustificativa,
    listarJustificativas,
};
