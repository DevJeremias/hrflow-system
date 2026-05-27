const db = require('../config/db');

exports.registrarPonto = async (req, res) => {
    try {
        // Pegamos o ID da empresa direto do token de segurança para blindar o Multi-Tenant
        const empresa_id = req.usuario.empresa_id;
        
        // Recebemos os dados enviados pelo Front-end (RelogioPonto.jsx)
        const { funcionario_id, latitude, longitude, tipo_registro, observacao } = req.body;

        if (!funcionario_id) {
            return res.status(400).json({ erro: 'O ID do funcionário é obrigatório.' });
        }

        // Validação de Segurança: Garante que o funcionário pertence à empresa do usuário logado
        const [verificacao] = await db.query(
            'SELECT id FROM funcionarios WHERE id = ? AND empresa_id = ?',
            [funcionario_id, empresa_id]
        );

        if (verificacao.length === 0) {
            return res.status(403).json({ erro: 'Acesso negado. Este funcionário não pertence à sua empresa.' });
        }

        // Insere o ponto no banco. A data_hora_oficial será gerada automaticamente pelo MySQL.
        const [resultado] = await db.query(
            `INSERT INTO registro_pontos 
            (funcionario_id, empresa_id, tipo_registro, latitude, longitude, observacao) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                funcionario_id, 
                empresa_id, 
                tipo_registro || 'Entrada', 
                latitude || null, 
                longitude || null, 
                observacao || ''
            ]
        );

        res.status(201).json({ 
            mensagem: 'Ponto registrado com sucesso!', 
            registro_id: resultado.insertId 
        });

    } catch (erro) {
        console.error('Erro ao registrar ponto:', erro);
        res.status(500).json({ erro: 'Erro interno ao salvar o registro de ponto.' });
    }
};

exports.listarPontos = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        
        // Traz os pontos ordenados do mais recente para o mais antigo, apenas da empresa logada
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