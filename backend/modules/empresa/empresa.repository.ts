// Todo o SQL dos dados da empresa. Devolve linhas como o MySQL as entrega e não conhece HTTP nem
// regra de negócio.
import type { RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';
import type { DadosDaEmpresa } from './empresa.schemas.ts';

export interface EmpresaGravada extends RowDataPacket {
    nome: string;
    razao_social: string | null;
    cnpj: string | null;
    regime_tributario: DadosDaEmpresa['regime_tributario'];
    encarregado_nome: string | null;
    encarregado_email: string | null;
}

export const empresaPorId = async (empresaId: number): Promise<EmpresaGravada | undefined> => {
    const [empresas] = await db.query<EmpresaGravada[]>(
        'SELECT nome, razao_social, cnpj, regime_tributario, encarregado_nome, encarregado_email FROM empresas WHERE id = ?',
        [empresaId]
    );
    return empresas[0];
};

export const atualizarDados = async (empresaId: number, dados: DadosDaEmpresa): Promise<void> => {
    // O encarregado só muda quando o corpo o traz (as duas chaves vêm juntas, o schema garante).
    const encarregado = dados.encarregado_nome === undefined ? '' : ', encarregado_nome = ?, encarregado_email = ?';
    await db.query(
        `UPDATE empresas SET razao_social = ?, cnpj = ?, regime_tributario = ?${encarregado} WHERE id = ?`,
        [dados.razao_social, dados.cnpj, dados.regime_tributario, ...(dados.encarregado_nome === undefined ? [] : [dados.encarregado_nome, dados.encarregado_email]), empresaId]
    );
};
