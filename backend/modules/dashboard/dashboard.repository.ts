// Todo o SQL do dashboard: contagens por empresa. Cada subconsulta filtra por empresa_id, então o
// resumo nunca enxerga dados de outra empresa.
import type { RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';

export interface ContagensDaEmpresa extends RowDataPacket {
    colaboradores_ativos: number;
    colaboradores_inativos: number;
    departamentos: number;
    cargos: number;
    marcacoes_hoje: number;
}

// Instantes em segundos Unix: [inicio, fim) é o dia de Belém (ponto.fuso.ts).
export const contagensDaEmpresa = async (empresaId: number, inicio: number, fim: number): Promise<ContagensDaEmpresa> => {
    const [[linha]] = await db.query<ContagensDaEmpresa[]>(
        `SELECT
            (SELECT COUNT(*) FROM funcionarios WHERE empresa_id = ? AND status <> 'Inativo') AS colaboradores_ativos,
            (SELECT COUNT(*) FROM funcionarios WHERE empresa_id = ? AND status = 'Inativo') AS colaboradores_inativos,
            (SELECT COUNT(*) FROM departamentos WHERE empresa_id = ?) AS departamentos,
            (SELECT COUNT(*) FROM cargos WHERE empresa_id = ?) AS cargos,
            (SELECT COUNT(*) FROM registro_pontos
              WHERE empresa_id = ? AND data_hora_oficial >= FROM_UNIXTIME(?) AND data_hora_oficial < FROM_UNIXTIME(?)) AS marcacoes_hoje`,
        [empresaId, empresaId, empresaId, empresaId, empresaId, inicio, fim]
    );
    return linha;
};
