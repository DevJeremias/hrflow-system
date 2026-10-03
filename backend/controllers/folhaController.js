const db = require('../config/db');
const { responderErro } = require('../utils/erros');
const { limiteEDeslocamento, enviarPagina } = require('../utils/paginacao');
const { calcularHolerite } = require('../modules/folha/folha.regras.ts');

exports.processarFolha = async (req, res) => {
    try {
        const empresa_id = req.usuario.empresa_id;
        
        const sql = `
            SELECT f.*, c.nome as cargo_nome, d.nome as departamento_nome 
            FROM funcionarios f
            LEFT JOIN cargos c ON f.cargo_id = c.id
            LEFT JOIN departamentos d ON f.departamento_id = d.id
            WHERE f.empresa_id = ? AND f.status = 'Ativo'
            ORDER BY f.id
            LIMIT ? OFFSET ?
        `;
        const [funcionarios] = await db.query(sql, [empresa_id, ...limiteEDeslocamento(req.dadosValidados.query)]);
        const [[{ total }]] = await db.query(
            "SELECT COUNT(*) AS total FROM funcionarios WHERE empresa_id = ? AND status = 'Ativo'", [empresa_id]
        );

        const folhaProcessada = funcionarios.map(emp => {
            const { baseSalary, inss, netSalary, employerCharges } = calcularHolerite(parseFloat(emp.salario_base) || 0);

            return {
                id: emp.id.toString(),
                name: emp.nome,
                role: emp.cargo_nome || 'Não definido',
                department: emp.departamento_nome || 'Não definido',
                baseSalary,
                totalEarnings: 0,
                totalDeductions: inss,
                totalGross: baseSalary,
                netSalary,
                employerCharges,
                earningsList: [],
                deductionsList: [{ description: 'Desconto INSS', value: inss, isPercentage: false }]
            };
        });

        enviarPagina(res, folhaProcessada, total);
    } catch (error) {
        responderErro(res, error, "Erro ao processar folha de pagamento");
    }
};

exports.meuHolerite = async (req, res) => {
    try {
        const id_usuario = req.usuario.id;
        const empresa_id = req.usuario.empresa_id;

        // usuarios.id e funcionarios.id são sequências independentes: a identidade vem do vínculo usuarios.funcionario_id
        const sql = `
            SELECT f.*, c.nome as cargo_nome, d.nome as departamento_nome
            FROM usuarios u
            JOIN funcionarios f ON f.id = u.funcionario_id AND f.empresa_id = u.empresa_id
            LEFT JOIN cargos c ON f.cargo_id = c.id
            LEFT JOIN departamentos d ON f.departamento_id = d.id
            WHERE u.id = ? AND u.empresa_id = ? AND f.status = 'Ativo'
        `;
        const [funcionarios] = await db.query(sql, [id_usuario, empresa_id]);

        if (funcionarios.length === 0) return res.status(404).json({ erro: "Colaborador não encontrado" });

        const emp = funcionarios[0];
        const { baseSalary, inss, netSalary, employerCharges } = calcularHolerite(parseFloat(emp.salario_base) || 0);

        // Retorna um Array (Para simular o histórico no Front-end)
        res.json([{
            id: emp.id.toString(),
            name: emp.nome,
            role: emp.cargo_nome || 'Não definido',
            department: emp.departamento_nome || 'Não definido',
            baseSalary,
            totalEarnings: 0,
            totalDeductions: inss,
            totalGross: baseSalary,
            netSalary,
            employerCharges,
            earningsList: [],
            deductionsList: [{ description: 'Desconto INSS', value: inss, isPercentage: false }]
        }]);

    } catch (error) {
        responderErro(res, error, "Erro ao buscar holerite");
    }
};
