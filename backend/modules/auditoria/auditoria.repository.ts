// Todo o SQL da leitura da trilha de auditoria. Devolve linhas como o MySQL as entrega e não conhece
// HTTP nem regra de negócio. A escrita é de shared/utils/auditar.ts.
import type { RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';

export interface LinhaDeAuditoria extends RowDataPacket {
    id: number;
    acao: string;
    entidade: string;
    entidade_id: number | null;
    funcionario_id: number | null;
    usuario_id: number | null;
    usuario_nome: string | null;
    perfil: string | null;
    ip: string | null;
    // JSON: o mysql2 já o entrega como objeto.
    antes: Record<string, unknown> | null;
    depois: Record<string, unknown> | null;
    criado_em: number;
}

export interface FiltroDeAuditoria {
    empresaId: number;
    entidade: string | null;
    id: number | null;
    acao: string | null;
}

// A empresa vem sempre primeiro. `entidade=funcionario&id=` lista tudo o que diz respeito àquele
// colaborador (funcionario_id): o que se fez no cadastro e também em torno dele (justificativas,
// pedidos de alteração, acessos). Para as outras entidades, o id é o do próprio registro.
const filtrar = ({ empresaId, entidade, id, acao }: FiltroDeAuditoria) => {
    const condicoes = ['empresa_id = ?'];
    const valores: (string | number)[] = [empresaId];
    if (entidade === 'funcionario' && id !== null) {
        condicoes.push('funcionario_id = ?');
        valores.push(id);
    } else {
        if (entidade) {
            condicoes.push('entidade = ?');
            valores.push(entidade);
        }
        if (id !== null) {
            condicoes.push('entidade_id = ?');
            valores.push(id);
        }
    }
    if (acao) {
        condicoes.push('acao LIKE ?');
        valores.push(`${acao.replace(/[\\%_]/g, '\\$&')}%`);
    }
    return { onde: condicoes.join(' AND '), valores };
};

export const listar = async (filtro: FiltroDeAuditoria, limite: number, deslocamento: number): Promise<LinhaDeAuditoria[]> => {
    const { onde, valores } = filtrar(filtro);
    const [linhas] = await db.query<LinhaDeAuditoria[]>(
        `SELECT id, acao, entidade, entidade_id, funcionario_id, usuario_id, usuario_nome, perfil, ip, antes, depois,
                CAST(UNIX_TIMESTAMP(criado_em) * 1000 AS UNSIGNED) AS criado_em
         FROM auditoria
         WHERE ${onde}
         ORDER BY id DESC
         LIMIT ? OFFSET ?`,
        [...valores, limite, deslocamento]
    );
    return linhas;
};

export const contar = async (filtro: FiltroDeAuditoria): Promise<number> => {
    const { onde, valores } = filtrar(filtro);
    const [[{ total }]] = await db.query<(RowDataPacket & { total: number })[]>(`SELECT COUNT(*) AS total FROM auditoria WHERE ${onde}`, valores);
    return total;
};
