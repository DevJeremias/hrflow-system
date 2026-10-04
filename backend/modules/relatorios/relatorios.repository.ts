// Todo o SQL dos relatórios que não vêm da folha nem do ponto: o histórico de admissões e desligamentos
// e os aniversários. Toda consulta filtra por empresa_id, então um relatório nunca enxerga outra empresa.
import type { RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';

interface ContagemDoMes extends RowDataPacket {
    mes: string;
    total: number;
}

export interface Aniversariante extends RowDataPacket {
    id: number;
    nome: string;
    departamento: string | null;
    cargo: string | null;
    dia: number;
}

// Quem estava na empresa no fim do dia anterior a `dia` ('AAAA-MM-DD'): já admitido (sem data de
// admissão vale como desde sempre) e ainda não desligado. Inativo sem data de desligamento nunca conta,
// porque não se sabe quando saiu.
export const ativosAntesDe = async (empresaId: number, dia: string): Promise<number> => {
    const [[{ total }]] = await db.query<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM funcionarios
         WHERE empresa_id = ?
           AND (data_admissao IS NULL OR data_admissao < ?)
           AND NOT (status = 'Inativo' AND (data_desligamento IS NULL OR data_desligamento < ?))`,
        [empresaId, dia, dia]
    );
    return total;
};

// Admissões por mês ('AAAA-MM') com data em [de, ate], datas 'AAAA-MM-DD'.
export const admissoesPorMes = async (empresaId: number, de: string, ate: string): Promise<Map<string, number>> => {
    const [linhas] = await db.query<ContagemDoMes[]>(
        `SELECT DATE_FORMAT(data_admissao, '%Y-%m') AS mes, COUNT(*) AS total
         FROM funcionarios
         WHERE empresa_id = ? AND data_admissao >= ? AND data_admissao <= ?
         GROUP BY mes`,
        [empresaId, de, ate]
    );
    return new Map(linhas.map((linha) => [linha.mes, linha.total]));
};

export const desligamentosPorMes = async (empresaId: number, de: string, ate: string): Promise<Map<string, number>> => {
    const [linhas] = await db.query<ContagemDoMes[]>(
        `SELECT DATE_FORMAT(data_desligamento, '%Y-%m') AS mes, COUNT(*) AS total
         FROM funcionarios
         WHERE empresa_id = ? AND status = 'Inativo' AND data_desligamento >= ? AND data_desligamento <= ?
         GROUP BY mes`,
        [empresaId, de, ate]
    );
    return new Map(linhas.map((linha) => [linha.mes, linha.total]));
};

// Quem faz aniversário no mês (1 a 12), em ordem de dia e de nome. Só o dia e o mês saem do banco: o ano
// de nascimento não é exposto. Desligado não é aniversariante.
export const aniversariantesDoMes = async (empresaId: number, mes: number): Promise<Aniversariante[]> => {
    const [linhas] = await db.query<Aniversariante[]>(
        `SELECT f.id, f.nome, d.nome AS departamento, c.nome AS cargo, DAY(f.data_nascimento) AS dia
         FROM funcionarios f
         LEFT JOIN departamentos d ON d.id = f.departamento_id AND d.empresa_id = f.empresa_id
         LEFT JOIN cargos c ON c.id = f.cargo_id AND c.empresa_id = f.empresa_id
         WHERE f.empresa_id = ? AND f.status <> 'Inativo' AND MONTH(f.data_nascimento) = ?
         ORDER BY DAY(f.data_nascimento), f.nome, f.id`,
        [empresaId, mes]
    );
    return linhas;
};
