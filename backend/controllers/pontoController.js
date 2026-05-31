// 1. Rota que grava o ponto e devolve a hora exata para a Timeline do Front-end
exports.registrarPonto = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        
        // CORREÇÃO: Mudamos "tipo_registro" para "tipo", que é o que o React envia
        const { funcionario_id, latitude, longitude, tipo, observacao } = req.body;

        if (!funcionario_id) {
            return res.status(400).json({ erro: 'O ID do funcionário é obrigatório.' });
        }

        const [verificacao] = await db.query(
            'SELECT id FROM funcionarios WHERE id = ? AND empresa_id = ?',
            [funcionario_id, empresa_id]
        );

        if (verificacao.length === 0) {
            return res.status(403).json({ erro: 'Acesso negado. Este funcionário não pertence à sua empresa.' });
        }

        const [resultado] = await db.query(
            `INSERT INTO registro_pontos 
            (funcionario_id, empresa_id, tipo_registro, latitude, longitude, observacao) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                funcionario_id, 
                empresa_id, 
                tipo || 'Entrada', // Agora ele vai usar o tipo correto (Pausa, Retorno, Saída)
                latitude || null, 
                longitude || null, 
                observacao || ''
            ]
        );

        // Devolvemos os dados para a interface
        const dataAtual = new Date();
        res.status(201).json({ 
            id: resultado.insertId.toString(),
            type: tipo || 'Entrada', // Devolve o tipo correto para a tela
            time: dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit', second: '2-digit' }),
            date: dataAtual.toISOString().split('T')[0]
        });

    } catch (erro) {
        console.error('Erro ao registrar ponto:', erro);
        res.status(500).json({ erro: 'Erro interno ao salvar o registro de ponto.' });
    }
};