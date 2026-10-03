// Regras da folha: monta o holerite de cada colaborador a partir do salário (folha.regras.ts).
// Não conhece HTTP (falhas de regra saem como ErroDeFolha) e só chega ao banco pelo repositório.
import { calcularHolerite } from './folha.regras.ts';
import * as repositorio from './folha.repository.ts';
import type { FuncionarioDaFolha } from './folha.repository.ts';
import { ErroDeFolha } from './folha.erros.ts';
import type { ConsultaDaFolha } from './folha.schemas.ts';
import { limiteEDeslocamento } from '../../shared/utils/paginacao.ts';

const NAO_DEFINIDO = 'Não definido';

// Formato que o front-end consome (frontend/src/services/payrollService.ts).
export interface HoleriteDoColaborador {
    id: string;
    name: string;
    role: string;
    department: string;
    baseSalary: number;
    totalEarnings: number;
    totalDeductions: number;
    totalGross: number;
    netSalary: number;
    employerCharges: number;
    earningsList: never[];
    deductionsList: { description: string; value: number; isPercentage: boolean }[];
}

const holeriteDe = (funcionario: FuncionarioDaFolha): HoleriteDoColaborador => {
    const { baseSalary, inss, netSalary, employerCharges } = calcularHolerite(parseFloat(funcionario.salario_base ?? '') || 0);
    return {
        id: funcionario.id.toString(),
        name: funcionario.nome,
        role: funcionario.cargo_nome || NAO_DEFINIDO,
        department: funcionario.departamento_nome || NAO_DEFINIDO,
        baseSalary,
        totalEarnings: 0,
        totalDeductions: inss,
        totalGross: baseSalary,
        netSalary,
        employerCharges,
        earningsList: [],
        deductionsList: [{ description: 'Desconto INSS', value: inss, isPercentage: false }],
    };
};

export const processarFolha = async ({ empresaId, consulta }: { empresaId: number; consulta: ConsultaDaFolha }) => {
    const [limite, deslocamento] = limiteEDeslocamento(consulta);
    const funcionarios = await repositorio.funcionariosAtivos(empresaId, limite, deslocamento);
    const total = await repositorio.contarFuncionariosAtivos(empresaId);
    return { holerites: funcionarios.map(holeriteDe), total };
};

// O front-end espera uma lista, para simular o histórico de holerites.
export const meuHolerite = async ({ usuarioId, empresaId }: { usuarioId: number; empresaId: number }): Promise<HoleriteDoColaborador[]> => {
    const funcionario = await repositorio.funcionarioDoUsuario(usuarioId, empresaId);
    if (!funcionario) throw new ErroDeFolha('inexistente', 'Colaborador não encontrado');
    return [holeriteDe(funcionario)];
};
