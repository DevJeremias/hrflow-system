const db = require('../../config/db');
const fuso = require('./ponto.fuso');
const regras = require('./ponto.regras');
const { responderErro } = require('../../utils/erros');

// Relógio do servidor em ms, trocável nos testes para fixar "agora" perto da virada do dia em Belém.
exports.relogio = { agora: () => Date.now() };
const agoraEmSegundos = () => Math.floor(exports.relogio.agora() / 1000);

const intervaloDoDia = (segundos) => fuso.limitesDoDia(fuso.diaLocal(segundos));

// Primeiro dia do mês seguinte a 'AAAA-MM', como 'AAAA-MM-01'.
const proximoMes = (mes) => {
    const [ano, m] = mes.split('-').map(Number);
    return m === 12 ? `${ano + 1}-01-01` : `${ano}-${String(m + 1).padStart(2, '0')}-01`;
};

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

        const [justificativas] = await db.query(
            `SELECT DATE_FORMAT(data_referencia, '%Y-%m-%d') AS dia, texto
             FROM justificativas_ponto
             WHERE funcionario_id = ? AND empresa_id = ? AND data_referencia >= ? AND data_referencia < ?`,
            [funcionario_id, empresa_id, `${mes}-01`, proximoMes(mes)]
        );
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

// O colaborador e a empresa vêm do token: o corpo e a URL só dizem o dia e o texto.
exports.enviarJustificativa = async (req, res) => {
    try {
        const { empresa_id, funcionario_id } = req.usuario;
        if (!funcionario_id) {
            return res.status(403).json({ erro: 'Acesso negado. Apenas colaboradores vinculados podem justificar o ponto.' });
        }
        const { data } = req.dadosValidados.params;
        const { texto } = req.dadosValidados.body;

        const [dono] = await db.query(
            'SELECT id FROM funcionarios WHERE id = ? AND empresa_id = ?',
            [funcionario_id, empresa_id]
        );
        if (dono.length === 0) {
            return res.status(404).json({ erro: 'Colaborador não encontrado nesta empresa.' });
        }

        await db.query(
            `INSERT INTO justificativas_ponto (empresa_id, funcionario_id, data_referencia, texto)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE texto = VALUES(texto)`,
            [empresa_id, funcionario_id, data, texto]
        );

        const [[salva]] = await db.query(
            `SELECT UNIX_TIMESTAMP(atualizado_em) AS instante
             FROM justificativas_ponto WHERE funcionario_id = ? AND data_referencia = ?`,
            [funcionario_id, data]
        );
        res.json({ date: data, note: texto, updatedAt: new Date(salva.instante * 1000).toISOString() });
    } catch (erro) {
        responderErro(res, erro, 'Erro interno ao salvar a justificativa.');
    }
};

exports.listarJustificativas = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        const { mes, funcionarioId } = req.dadosValidados.query;

        const filtros = ['j.empresa_id = ?', 'j.data_referencia >= ?', 'j.data_referencia < ?'];
        const valores = [empresa_id, `${mes}-01`, proximoMes(mes)];
        if (funcionarioId) {
            filtros.push('j.funcionario_id = ?');
            valores.push(funcionarioId);
        }

        const [linhas] = await db.query(
            `SELECT j.id, j.funcionario_id, f.nome AS nome_funcionario,
                    DATE_FORMAT(j.data_referencia, '%Y-%m-%d') AS date, j.texto AS note,
                    UNIX_TIMESTAMP(j.criado_em) AS criado, UNIX_TIMESTAMP(j.atualizado_em) AS atualizado
             FROM justificativas_ponto j
             JOIN funcionarios f ON f.id = j.funcionario_id AND f.empresa_id = j.empresa_id
             WHERE ${filtros.join(' AND ')}
             ORDER BY j.data_referencia DESC, f.nome ASC, j.id ASC`,
            valores
        );

        res.json(linhas.map(({ criado, atualizado, ...j }) => ({
            ...j,
            createdAt: new Date(criado * 1000).toISOString(),
            updatedAt: new Date(atualizado * 1000).toISOString(),
        })));
    } catch (erro) {
        responderErro(res, erro, 'Erro interno ao buscar as justificativas.');
    }
};
