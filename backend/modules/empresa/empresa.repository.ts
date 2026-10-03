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
    fuso: string;
}

export const empresaPorId = async (empresaId: number): Promise<EmpresaGravada | undefined> => {
    const [empresas] = await db.query<EmpresaGravada[]>(
        'SELECT nome, razao_social, cnpj, regime_tributario, fuso FROM empresas WHERE id = ?',
        [empresaId]
    );
    return empresas[0];
};

export const atualizarDados = async (empresaId: number, dados: DadosDaEmpresa): Promise<void> => {
    await db.query(
        'UPDATE empresas SET razao_social = ?, cnpj = ?, regime_tributario = ?, fuso = COALESCE(?, fuso) WHERE id = ?',
        [dados.razao_social, dados.cnpj, dados.regime_tributario, dados.fuso, empresaId]
    );
};

export const fusoDaEmpresa = async (empresaId: number): Promise<string | undefined> => {
    const [empresas] = await db.query<(RowDataPacket & { fuso: string })[]>('SELECT fuso FROM empresas WHERE id = ?', [empresaId]);
    return empresas[0]?.fuso;
};
