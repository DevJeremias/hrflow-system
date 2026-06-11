const db = require('../config/db');

exports.meuPerfil = async (req, res) => {
    try {
        // O authMiddleware extrai isto do Token
        const usuario_id = req.usuario.id;
        const empresa_id = req.usuario.empresa_id;

        // Juntamos a tabela 'usuarios' com 'funcionarios' através do email
        const query = `
            SELECT 
                f.id, f.nome, f.cpf, f.email, f.telefone, 
                f.data_nascimento, f.data_admissao, f.tipo_contrato, 
                f.status, f.endereco, f.banco, f.agencia, f.conta, f.tipo_conta, f.nivel,
                c.nome AS cargo_nome, 
                d.nome AS departamento_nome
            FROM usuarios u
            LEFT JOIN funcionarios f ON u.email = f.email AND f.empresa_id = u.empresa_id
            LEFT JOIN cargos c ON f.cargo_id = c.id
            LEFT JOIN departamentos d ON f.departamento_id = d.id
            WHERE u.id = ? AND u.empresa_id = ?
        `;

        const [resultados] = await db.query(query, [usuario_id, empresa_id]);

        if (resultados.length === 0 || !resultados[0].cpf) {
            return res.status(404).json({ erro: 'Dados de funcionário não encontrados. Certifique-se de que o e-mail do login corresponde ao e-mail no cadastro de funcionário.' });
        }

        res.json(resultados[0]);

    } catch (erro) {
        console.error('Erro ao buscar o perfil do utilizador:', erro);
        res.status(500).json({ erro: 'Erro interno ao buscar dados do perfil.' });
    }
};