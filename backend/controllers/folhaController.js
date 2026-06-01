const db = require('../config/db');

exports.processarFolha = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        
        // Puxa APENAS os funcionários com status 'Ativo'
        const sql = `
            SELECT f.*, c.nome as cargo_nome, d.nome as departamento_nome 
            FROM funcionarios f
            LEFT JOIN cargos c ON f.cargo_id = c.id
            LEFT JOIN departamentos d ON f.departamento_id = d.id
            WHERE f.empresa_id = ? AND f.status = 'Ativo'
        `;
        const [funcionarios] = await db.query(sql, [empresa_id]);

        // Mapeia e calcula a folha de cada funcionário
        const folhaProcessada = funcionarios.map(emp => {
            const baseSalary = parseFloat(emp.salario_base) || 0;
            
            // 1. Cálculo de Desconto INSS (Lógica simplificada para holerite)
            let inss = 0;
            if (baseSalary > 0) {
                if (baseSalary <= 1412) inss = baseSalary * 0.075;
                else if (baseSalary <= 2666.68) inss = (baseSalary * 0.09) - 21.18;
                else if (baseSalary <= 4000.03) inss = (baseSalary * 0.12) - 101.18;
                else inss = (baseSalary * 0.14) - 181.18;
                
                if (inss > 908.85) inss = 908.85; // Teto máximo do INSS
            }
            if (inss < 0) inss = 0;

            const totalEarnings = 0; // Preparado para receber Bônus e Extras futuramente
            const totalGross = baseSalary + totalEarnings;
            const totalDeductions = inss;
            const netSalary = totalGross - totalDeductions;
            
            // Encargos da Empresa (Estimativa de 27.8% para FGTS + INSS Patronal)
            const employerCharges = baseSalary * 0.278; 

            return {
                id: emp.id.toString(),
                name: emp.nome,
                role: emp.cargo_nome || 'Não definido',
                department: emp.departamento_nome || 'Não definido',
                baseSalary,
                totalEarnings,
                totalDeductions,
                totalGross,
                netSalary,
                employerCharges,
                earningsList: [],
                deductionsList: [
                    { description: 'Desconto INSS', value: inss, isPercentage: false }
                ]
            };
        });

        res.json(folhaProcessada);
    } catch (error) {
        console.error("Erro ao processar folha:", error);
        res.status(500).json({ erro: "Erro ao processar folha de pagamento" });
    }
};