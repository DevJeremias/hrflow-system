// Todo o SQL da folha: colaboradores ativos da empresa, com cargo e departamento. Devolve linhas
// como o MySQL as entrega e não conhece HTTP nem regra de negócio.
import type { RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';

// salario_base é DECIMAL: o mysql2 o entrega como texto.
export interface FuncionarioDaFolha extends RowDataPacket {
    id: number;
    nome: string;
    salario_base: string | null;
    cargo_nome: string | null;
    departamento_nome: string | null;
}

export const funcionariosAtivos = async (empresaId: number, limite: number, deslocamento: number): Promise<FuncionarioDaFolha[]> => {
    const [funcionarios] = await db.query<FuncionarioDaFolha[]>(
        `SELECT f.*, c.nome as cargo_nome, d.nome as departamento_nome
            FROM funcionarios f
            LEFT JOIN cargos c ON f.cargo_id = c.id
            LEFT JOIN departamentos d ON f.departamento_id = d.id
            WHERE f.empresa_id = ? AND f.status = 'Ativo'
            ORDER BY f.id
            LIMIT ? OFFSET ?`,
        [empresaId, limite, deslocamento]
    );
    return funcionarios;
};

export const contarFuncionariosAtivos = async (empresaId: number): Promise<number> => {
    const [[{ total }]] = await db.query<({ total: number } & RowDataPacket)[]>(
        "SELECT COUNT(*) AS total FROM funcionarios WHERE empresa_id = ? AND status = 'Ativo'",
        [empresaId]
    );
    return total;
};

// usuarios.id e funcionarios.id são sequências independentes: a identidade vem do vínculo
// usuarios.funcionario_id, e só vale dentro da mesma empresa do usuário.
export const funcionarioDoUsuario = async (usuarioId: number, empresaId: number): Promise<FuncionarioDaFolha | undefined> => {
    const [funcionarios] = await db.query<FuncionarioDaFolha[]>(
        `SELECT f.*, c.nome as cargo_nome, d.nome as departamento_nome
            FROM usuarios u
            JOIN funcionarios f ON f.id = u.funcionario_id AND f.empresa_id = u.empresa_id
            LEFT JOIN cargos c ON f.cargo_id = c.id
            LEFT JOIN departamentos d ON f.departamento_id = d.id
            WHERE u.id = ? AND u.empresa_id = ? AND f.status = 'Ativo'`,
        [usuarioId, empresaId]
    );
    return funcionarios[0];
};
