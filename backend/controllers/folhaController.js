const db = require('../config/db');

exports.gerarFolha = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;

        // Busca todos os funcionários Ativos e junta com o salário do Cargo deles
        const sql = `
            SELECT f.id, f.nome, d.nome as departamento, c.nome as cargo, c.salario_base
            FROM funcionarios f
            LEFT JOIN departamentos d ON f.departamento_id = d.id
            LEFT JOIN cargos c ON f.cargo_id = c.id
            WHERE f.empresa_id = ? AND f.status = 'Ativo'
        `;

        const [funcionarios] = await db.query(sql, [empresa_id]);

        // Faz o cálculo individual para cada funcionário
        const folhaCalculada = funcionarios.map(func => {
            const salarioBase = parseFloat(func.salario_base) || 0;
            
            // Para este primeiro momento, vamos usar uma regra geral. 
            // Numa versão futura, podemos cruzar isso com as horas do Ponto Eletrônico!
            const totalProventos = 500; // Ex: R$ 500 de Auxílio/Benefícios padrão
            const totalBruto = salarioBase + totalProventos;
            
            // Simulação de Descontos (Ex: 10% de INSS/Impostos)
            const totalDescontos = salarioBruto => salarioBruto * 0.10; 
            const valorDesconto = totalDescontos(totalBruto);

            // Simulação de Encargos Patronais (Ex: 20% que a empresa paga por fora)
            const encargosEmpresa = salarioBase * 0.20;

            return {
                id: func.id.toString(),
                name: func.nome,
                role: func.cargo || 'Não definido',
                department: func.departamento || 'Não definido',
                baseSalary: salarioBase,
                totalEarnings: totalProventos,
                totalGross: totalBruto,
                totalDeductions: valorDesconto,
                netSalary: totalBruto - valorDesconto,
                employerCharges: encargosEmpresa,
                
                // Detalhamento para o Holerite
                earningsList: [
                    { description: 'Salário Base', value: salarioBase, isPercentage: false },
                    { description: 'Benefícios Corporativos', value: totalProventos, isPercentage: false }
                ],
                deductionsList: [
                    { description: 'INSS / IRRF (Estimativa)', value: valorDesconto, isPercentage: true, percent: 10 }
                ]
            };
        });

        res.json(folhaCalculada);

    } catch (erro) {
        console.error('Erro ao processar folha:', erro);
        res.status(500).json({ erro: 'Erro interno ao gerar a folha de pagamento.' });
    }
};