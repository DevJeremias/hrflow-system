// Todo o SQL da estrutura organizacional: departamentos e cargos. Devolve linhas como o MySQL as
// entrega e não conhece HTTP nem regra de negócio. Toda consulta filtra por empresa_id.
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.js';
import type { DadosDoCargo, DadosDoDepartamento } from './estrutura.schemas.ts';

export interface DepartamentoListado extends RowDataPacket {
    id: number;
    nome: string;
    sigla: string;
    descricao: string | null;
    gestor: string | null;
    empresa_id: number;
    total_colaboradores: number;
    colaboradores_ativos: number;
    total_cargos: number;
}

// salario_base é DECIMAL: o mysql2 o entrega como texto.
export interface CargoListado extends RowDataPacket {
    id: number;
    nome: string;
    departamento_id: number | null;
    nivel: string | null;
    salario_base: string | null;
    empresa_id: number;
    departamento_nome: string | null;
    departamento_sigla: string | null;
    ocupantes: number;
}

interface Contagem extends RowDataPacket {
    total: number;
}

// O pool ou a conexão da transação em andamento.
export type Executor = Pick<Pool, 'query'>;

export const listarDepartamentos = async (empresaId: number, limite: number, deslocamento: number): Promise<DepartamentoListado[]> => {
    const [linhas] = await db.query<DepartamentoListado[]>(
        `SELECT d.*,
                COUNT(f.id) AS total_colaboradores,
                COUNT(CASE WHEN f.status = 'Ativo' THEN 1 END) AS colaboradores_ativos,
                (SELECT COUNT(*) FROM cargos c WHERE c.departamento_id = d.id AND c.empresa_id = d.empresa_id) AS total_cargos
         FROM departamentos d
         LEFT JOIN funcionarios f ON f.departamento_id = d.id AND f.empresa_id = d.empresa_id
         WHERE d.empresa_id = ?
         GROUP BY d.id
         ORDER BY d.id
         LIMIT ? OFFSET ?`,
        [empresaId, limite, deslocamento]
    );
    return linhas;
};

export const contarDepartamentos = async (empresaId: number): Promise<number> => {
    const [[{ total }]] = await db.query<Contagem[]>('SELECT COUNT(*) AS total FROM departamentos WHERE empresa_id = ?', [empresaId]);
    return total;
};

export const criarDepartamento = async (empresaId: number, { nome, sigla, descricao, gestor }: DadosDoDepartamento): Promise<void> => {
    await db.query(
        'INSERT INTO departamentos (nome, sigla, descricao, gestor, empresa_id) VALUES (?, ?, ?, ?, ?)',
        [nome, sigla, descricao, gestor, empresaId]
    );
};

// Devolve se algum departamento da empresa foi alterado.
export const atualizarDepartamento = async (id: number, empresaId: number, { nome, sigla, descricao, gestor }: DadosDoDepartamento): Promise<boolean> => {
    const [resultado] = await db.query<ResultSetHeader>(
        `UPDATE departamentos
         SET nome = ?, sigla = ?, descricao = ?, gestor = ?
         WHERE id = ? AND empresa_id = ?`,
        [nome, sigla, descricao, gestor, id, empresaId]
    );
    return resultado.affectedRows > 0;
};

export const departamentoTemCargos = async (id: number, empresaId: number): Promise<boolean> => {
    const [cargos] = await db.query<RowDataPacket[]>('SELECT id FROM cargos WHERE departamento_id = ? AND empresa_id = ?', [id, empresaId]);
    return cargos.length > 0;
};

// Devolve se algum departamento da empresa foi removido.
export const removerDepartamento = async (id: number, empresaId: number): Promise<boolean> => {
    const [resultado] = await db.query<ResultSetHeader>('DELETE FROM departamentos WHERE id = ? AND empresa_id = ?', [id, empresaId]);
    return resultado.affectedRows > 0;
};

export const listarCargos = async (empresaId: number, limite: number, deslocamento: number): Promise<CargoListado[]> => {
    const [linhas] = await db.query<CargoListado[]>(
        `SELECT c.*, d.nome as departamento_nome, d.sigla as departamento_sigla,
                COUNT(f.id) AS ocupantes
         FROM cargos c
         LEFT JOIN departamentos d ON c.departamento_id = d.id AND d.empresa_id = c.empresa_id
         LEFT JOIN funcionarios f ON f.cargo_id = c.id AND f.empresa_id = c.empresa_id AND f.status = 'Ativo'
         WHERE c.empresa_id = ?
         GROUP BY c.id, d.nome, d.sigla
         ORDER BY c.id
         LIMIT ? OFFSET ?`,
        [empresaId, limite, deslocamento]
    );
    return linhas;
};

export const contarCargos = async (empresaId: number): Promise<number> => {
    const [[{ total }]] = await db.query<Contagem[]>('SELECT COUNT(*) AS total FROM cargos WHERE empresa_id = ?', [empresaId]);
    return total;
};

export const criarCargo = async (empresaId: number, { nome, departamento_id, nivel, salario_base }: DadosDoCargo): Promise<void> => {
    await db.query(
        'INSERT INTO cargos (nome, departamento_id, nivel, salario_base, empresa_id) VALUES (?, ?, ?, ?, ?)',
        [nome, departamento_id, nivel, salario_base, empresaId]
    );
};

// Devolve se algum cargo da empresa foi alterado.
export const atualizarCargo = async (id: number, empresaId: number, { nome, departamento_id, nivel, salario_base }: DadosDoCargo): Promise<boolean> => {
    const [resultado] = await db.query<ResultSetHeader>(
        'UPDATE cargos SET nome = ?, departamento_id = ?, nivel = ?, salario_base = ? WHERE id = ? AND empresa_id = ?',
        [nome, departamento_id, nivel, salario_base, id, empresaId]
    );
    return resultado.affectedRows > 0;
};

export const cargoTemOcupantesAtivos = async (id: number, empresaId: number): Promise<boolean> => {
    const [funcionarios] = await db.query<RowDataPacket[]>(
        'SELECT id FROM funcionarios WHERE cargo_id = ? AND empresa_id = ? AND status = "Ativo"',
        [id, empresaId]
    );
    return funcionarios.length > 0;
};

// Devolve se algum cargo da empresa foi removido.
export const removerCargo = async (id: number, empresaId: number): Promise<boolean> => {
    const [resultado] = await db.query<ResultSetHeader>('DELETE FROM cargos WHERE id = ? AND empresa_id = ?', [id, empresaId]);
    return resultado.affectedRows > 0;
};

// Valida no servidor que cargo e departamento informados pertencem à empresa de quem opera.
// Os ids chegam do cliente e não carregam empresa: sem esta checagem, um id de outra empresa
// é aceito e os JOINs de listagem devolvem o nome dele.
const existeNaEmpresa = async (executor: Executor, tabela: 'departamentos' | 'cargos', id: number, empresaId: number): Promise<boolean> => {
    const [linhas] = await executor.query<RowDataPacket[]>(`SELECT id FROM ${tabela} WHERE id = ? AND empresa_id = ?`, [id, empresaId]);
    return linhas.length > 0;
};

// `executor` é o pool ou a conexão da transação em andamento: o cadastro de colaboradores confere
// as referências dentro da própria transação.
export const departamentoDaEmpresa = (executor: Executor, id: number, empresaId: number) => existeNaEmpresa(executor, 'departamentos', id, empresaId);

export const cargoDaEmpresa = (executor: Executor, id: number, empresaId: number) => existeNaEmpresa(executor, 'cargos', id, empresaId);

// Mesma conferência no pool, para as regras da própria estrutura.
export const departamentoExiste = (id: number, empresaId: number) => departamentoDaEmpresa(db, id, empresaId);

export const cargoExiste = (id: number, empresaId: number) => cargoDaEmpresa(db, id, empresaId);
