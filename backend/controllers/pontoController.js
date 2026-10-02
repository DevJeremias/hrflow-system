const db = require('../config/db');
const fuso = require('../utils/fusoPonto');
const regras = require('../utils/pontoRegras');

// Relógio do servidor em ms, trocável nos testes para fixar "agora" perto da virada do dia em Belém.
exports.relogio = { agora: () => Date.now() };
const agoraEmSegundos = () => Math.floor(exports.relogio.agora() / 1000);

const intervaloDoDia = (segundos) => fuso.limitesDoDia(fuso.diaLocal(segundos));

const montarRegistro = (id, tipo, segundos) => ({
    id: id.toString(),
    type: tipo,
    time: fuso.horaLocal(segundos),
    date: fuso.diaLocal(segundos),
});

exports.registrarPonto = async (req, res) => {
    let conexao;
    try {
        const empresa_id = req.usuario.empresa_id;
        // SEGURANÇA: O ID vem do token criptografado, não do req.body
        const funcionario_id = req.usuario.funcionario_id; 

        if (!funcionario_id) {
            return res.status(403).json({ erro: 'Acesso negado. Apenas colaboradores vinculados podem registrar ponto.' });
        }

        const corpo = req.body || {};
        const tipo = regras.validarTipo(corpo.tipo);
        const coordenadas = regras.validarCoordenadas(corpo);
        const observacao = regras.validarObservacao(corpo.observacao);
        const invalido = [tipo, coordenadas, observacao].find((r) => r.erro);
        if (invalido) return res.status(400).json({ erro: invalido.erro });

        const agora = agoraEmSegundos();
        const { inicio, fim } = intervaloDoDia(agora);

        conexao = await db.getConnection();
        await conexao.beginTransaction();

        // O bloqueio da linha do colaborador serializa marcações simultâneas (duplo clique, duas
        // abas): sem ele, ambas leem o mesmo último registro e passam na validação da sequência.
        const [dono] = await conexao.query(
            'SELECT id FROM funcionarios WHERE id = ? AND empresa_id = ? FOR UPDATE',
            [funcionario_id, empresa_id]
        );
        if (dono.length === 0) {
            await conexao.rollback();
            return res.status(404).json({ erro: 'Colaborador não encontrado nesta empresa.' });
        }

        const [ultimos] = await conexao.query(
            `SELECT tipo_registro, UNIX_TIMESTAMP(data_hora_oficial) AS instante
             FROM registro_pontos
             WHERE funcionario_id = ? AND empresa_id = ?
               AND data_hora_oficial >= FROM_UNIXTIME(?) AND data_hora_oficial < FROM_UNIXTIME(?)
             ORDER BY data_hora_oficial DESC, id DESC
             LIMIT 1`,
            [funcionario_id, empresa_id, inicio, fim]
        );
        const ultimo = ultimos[0];

        const permitidos = regras.proximosPermitidos(ultimo ? ultimo.tipo_registro : null);
        if (!permitidos.includes(tipo.dados)) {
            await conexao.rollback();
            const resumo = ultimo
                ? `O último registro de hoje foi "${ultimo.tipo_registro}" às ${fuso.horaLocal(ultimo.instante)}.`
                : 'Ainda não há registros hoje.';
            const proximo = permitidos.length > 0
                ? `Registre ${permitidos.map((t) => `"${t}"`).join(' ou ')}.`
                : 'A jornada de hoje já foi encerrada.';
            return res.status(409).json({
                erro: `Sequência de marcações inválida para "${tipo.dados}". ${resumo} ${proximo}`,
                proximosPermitidos: permitidos,
            });
        }

        const [resultado] = await conexao.query(
            `INSERT INTO registro_pontos 
            (funcionario_id, empresa_id, tipo_registro, latitude, longitude, data_hora_oficial, observacao) 
            VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?), ?)`,
            [
                funcionario_id,
                empresa_id,
                tipo.dados,
                coordenadas.dados.latitude,
                coordenadas.dados.longitude,
                agora,
                observacao.dados,
            ]
        );
        await conexao.commit();

        res.status(201).json(montarRegistro(resultado.insertId, tipo.dados, agora));

    } catch (erro) {
        if (conexao) await conexao.rollback().catch(() => {});
        console.error('Erro ao registrar ponto:', erro);
        res.status(500).json({ erro: 'Erro interno ao salvar o registro de ponto.' });
    } finally {
        if (conexao) conexao.release();
    }
};

exports.listarPontosHoje = async (req, res) => {
    try {
        // O middleware já autorizou este id para o perfil; a empresa continua vindo do token
        const funcionario_id = req.params.funcionarioId;
        const empresa_id = req.usuario.empresa_id;
        const { inicio, fim } = intervaloDoDia(agoraEmSegundos());

        const [pontos] = await db.query(
            `SELECT id, tipo_registro, UNIX_TIMESTAMP(data_hora_oficial) AS instante
             FROM registro_pontos 
             WHERE funcionario_id = ? AND empresa_id = ?
               AND data_hora_oficial >= FROM_UNIXTIME(?) AND data_hora_oficial < FROM_UNIXTIME(?)
             ORDER BY data_hora_oficial ASC, id ASC`,
            [funcionario_id, empresa_id, inicio, fim]
        );

        res.json(pontos.map(p => montarRegistro(p.id, p.tipo_registro, p.instante)));
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao buscar pontos de hoje.' });
    }
};

exports.listarHistorico = async (req, res) => {
    try {
        const funcionario_id = req.params.funcionarioId;
        const { mes } = req.query; 
        const empresa_id = req.usuario.empresa_id;

        if (!fuso.mesValido(mes)) {
            return res.status(400).json({ erro: 'Informe o mês no formato AAAA-MM (ex.: 2026-03).' });
        }
        const { inicio, fim } = fuso.limitesDoMes(mes);

        const [pontos] = await db.query(
            `SELECT tipo_registro, UNIX_TIMESTAMP(data_hora_oficial) AS instante, observacao 
             FROM registro_pontos 
             WHERE funcionario_id = ? AND empresa_id = ?
               AND data_hora_oficial >= FROM_UNIXTIME(?) AND data_hora_oficial < FROM_UNIXTIME(?)
             ORDER BY data_hora_oficial ASC, id ASC`,
            [funcionario_id, empresa_id, inicio, fim]
        );

        const dias = {};
        
        pontos.forEach(p => {
            const dataStr = fuso.diaLocal(p.instante);
            const horaStr = fuso.horaLocal(p.instante).slice(0, 5);

            if (!dias[dataStr]) {
                dias[dataStr] = {
                    id: dataStr, date: dataStr, entry: '--:--', lunchOut: '--:--', lunchIn: '--:--', exit: '--:--',
                    totalHours: '--:--', status: 'OK', note: p.observacao || '', negativeAdjust: '00:00', positiveAdjust: '00:00'
                };
            }

            if (p.tipo_registro === 'Entrada') dias[dataStr].entry = horaStr;
            else if (p.tipo_registro === 'Pausa Almoço') dias[dataStr].lunchOut = horaStr;
            else if (p.tipo_registro === 'Retorno Almoço') dias[dataStr].lunchIn = horaStr;
            else if (p.tipo_registro === 'Saída') dias[dataStr].exit = horaStr;
        });

        res.json(Object.values(dias));
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao buscar histórico.' });
    }
};

exports.listarTotais = async (req, res) => {
    res.json({
        totals: [
            { id: 'w1', weekLabel: 'Semana Atual', workloadLimit: '44:00', workloadPreset: '44:00', workloadDone: '--:--', presenceTime: '--:--', pendingTime: '--:--', excessTime: '--:--', hoursBank: '--:--', dailyAdjustBalance: '--:--' }
        ],
        monthlySummary: { workloadLimit: '220:00', workloadPreset: '220:00', workloadDone: '--:--', presenceTime: '--:--', pendingTime: '--:--', excessTime: '--:--', hoursBank: '--:--', dailyAdjustBalance: '--:--' }
    });
};

exports.listarPontos = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        
        const [pontos] = await db.query(
            `SELECT p.id, p.funcionario_id, p.empresa_id, p.tipo_registro, p.latitude, p.longitude, p.observacao,
                    UNIX_TIMESTAMP(p.data_hora_oficial) AS instante, f.nome as nome_funcionario 
             FROM registro_pontos p
             JOIN funcionarios f ON p.funcionario_id = f.id
             WHERE p.empresa_id = ?
             ORDER BY p.data_hora_oficial DESC`,
            [empresa_id]
        );

        // data_hora_oficial segue como instante ISO em UTC; date e time são o relógio de Belém.
        res.json(pontos.map(({ instante, ...p }) => ({
            ...p,
            data_hora_oficial: new Date(instante * 1000).toISOString(),
            date: fuso.diaLocal(instante),
            time: fuso.horaLocal(instante),
        })));
    } catch (erro) {
        console.error('Erro ao listar pontos:', erro);
        res.status(500).json({ erro: 'Erro interno ao buscar os registros.' });
    }
};