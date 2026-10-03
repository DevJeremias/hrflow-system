// Todo o SQL da autenticação. Devolve linhas como o MySQL as entrega e não conhece HTTP nem regra
// de negócio.
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';
import type { UsuarioDoToken } from './auth.sessao.ts';

export interface Usuario extends RowDataPacket, UsuarioDoToken {
    nome: string;
    senha: string;
}

export interface FuncionarioDoUsuario extends RowDataPacket {
    nome: string;
    status: string;
}

export interface IdentidadeDaSessao extends RowDataPacket {
    id: number;
    perfil: string;
    empresa_id: number;
    empresa_nome: string;
    funcionario_id: number | null;
    avatar: string | null;
    nome: string;
}

export interface NovaConta {
    nomeEmpresa: string;
    nomeAdmin: string;
    email: string;
    senhaCripto: string;
}

export const emailJaCadastrado = async (email: string): Promise<boolean> => {
    const [usuarios] = await db.query<RowDataPacket[]>('SELECT id FROM usuarios WHERE email = ?', [email]);
    return usuarios.length > 0;
};

// A empresa e o administrador entram juntos ou nenhum dos dois entra. A chave única de
// usuarios.email recusa (ER_DUP_ENTRY) o cadastro que perdeu a corrida.
export const criarEmpresaComAdministrador = async ({ nomeEmpresa, nomeAdmin, email, senhaCripto }: NovaConta): Promise<void> => {
    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        const [empresa] = await conexao.query<ResultSetHeader>('INSERT INTO empresas (nome) VALUES (?)', [nomeEmpresa]);
        await conexao.query(
            'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id) VALUES (?, ?, ?, ?, ?)',
            [nomeAdmin, email, senhaCripto, 'Administrador', empresa.insertId]
        );
        await conexao.commit();
    } catch (erro) {
        await conexao.rollback().catch(() => {});
        throw erro;
    } finally {
        conexao.release();
    }
};

export const usuarioPorEmail = async (email: string): Promise<Usuario | undefined> => {
    const [usuarios] = await db.query<Usuario[]>('SELECT * FROM usuarios WHERE email = ?', [email]);
    return usuarios[0];
};

export const funcionarioDoUsuario = async (funcionarioId: number, empresaId: number): Promise<FuncionarioDoUsuario | undefined> => {
    const [funcionarios] = await db.query<FuncionarioDoUsuario[]>(
        'SELECT nome, status FROM funcionarios WHERE id = ? AND empresa_id = ?',
        [funcionarioId, empresaId]
    );
    return funcionarios[0];
};

export const identidadeDaSessao = async (usuarioId: number): Promise<IdentidadeDaSessao | undefined> => {
    const [linhas] = await db.query<IdentidadeDaSessao[]>(
        `SELECT u.id, u.perfil, u.empresa_id, e.nome AS empresa_nome, u.funcionario_id, u.avatar,
                COALESCE(f.nome, u.nome) AS nome
         FROM usuarios u
         JOIN empresas e ON e.id = u.empresa_id
         LEFT JOIN funcionarios f ON f.id = u.funcionario_id AND f.empresa_id = u.empresa_id
         WHERE u.id = ?`,
        [usuarioId]
    );
    return linhas[0];
};
