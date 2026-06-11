const db = require('../config/db');

exports.registrarPonto = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        // SEGURANÇA: O ID vem do token criptografado, não do req.body
        const funcionario_id = req.usuario.funcionario_id; 
        
        const { latitude, longitude, tipo, observacao } = req.body;

        if (!funcionario_id) {
            return res.status(403).json({ erro: 'Acesso negado. Apenas colaboradores vinculados podem registrar ponto.' });
        }

        const [resultado] = await db.query(
            `INSERT INTO registro_pontos 
            (funcionario_id, empresa_id, tipo_registro, latitude, longitude, observacao) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                funcionario_id, 
                empresa_id, 
                tipo || 'Entrada', 
                latitude || null, 
                longitude || null, 
                observacao || ''
            ]
        );

        const dataAtual = new Date();
        res.status(201).json({ 
            id: resultado.insertId.toString(),
            type: tipo || 'Entrada', 
            time: dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit', second: '2-digit' }),
            date: dataAtual.toISOString().split('T')[0]
        });

    } catch (erro) {
        console.error('Erro ao registrar ponto:', erro);
        res.status(500).json({ erro: 'Erro interno ao salvar o registro de ponto.' });
    }
};

exports.listarPontosHoje = async (req, res) => {
    try {
        const funcionario_id = req.usuario.funcionario_id;
        const empresa_id = req.usuario.empresa_id;

        const [pontos] = await db.query(
            `SELECT id, tipo_registro, data_hora_oficial 
             FROM registro_pontos 
             WHERE funcionario_id = ? AND empresa_id = ? AND DATE(data_hora_oficial) = CURDATE()
             ORDER BY data_hora_oficial ASC`,
            [funcionario_id, empresa_id]
        );

        const formatados = pontos.map(p => {
            const dataObj = new Date(p.data_hora_oficial);
            return {
                id: p.id.toString(),
                type: p.tipo_registro,
                time: dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit', second: '2-digit' }),
                date: dataObj.toISOString().split('T')[0]
            };
        });

        res.json(formatados);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao buscar pontos de hoje.' });
    }
};

exports.listarHistorico = async (req, res) => {
    try {
        const funcionario_id = req.usuario.funcionario_id;
        const { mes } = req.query; 
        const empresa_id = req.usuario.empresa_id;

        const [pontos] = await db.query(
            `SELECT tipo_registro, data_hora_oficial, observacao 
             FROM registro_pontos 
             WHERE funcionario_id = ? AND empresa_id = ? AND DATE_FORMAT(data_hora_oficial, '%Y-%m') = ?
             ORDER BY data_hora_oficial ASC`,
            [funcionario_id, empresa_id, mes]
        );

        const dias = {};
        
        pontos.forEach(p => {
            const dataObj = new Date(p.data_hora_oficial);
            const dataStr = dataObj.toISOString().split('T')[0];
            const horaStr = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' });

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
            `SELECT p.*, f.nome as nome_funcionario 
             FROM registro_pontos p
             JOIN funcionarios f ON p.funcionario_id = f.id
             WHERE p.empresa_id = ?
             ORDER BY p.data_hora_oficial DESC`,
            [empresa_id]
        );

        res.json(pontos);
    } catch (erro) {
        console.error('Erro ao listar pontos:', erro);
        res.status(500).json({ erro: 'Erro interno ao buscar os registros.' });
    }
};