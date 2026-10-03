// Todo o SQL da autenticação. Devolve linhas como o MySQL as entrega e não conhece HTTP nem regra
// de negócio.
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';
import { urlDoAvatarSql } from '../../shared/utils/avatar.ts';
import type { UsuarioDoToken } from './auth.sessao.ts';

export interface Usuario extends RowDataPacket, UsuarioDoToken {
    nome: string;
    senha: string;
    senha_provisoria: number;
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
    empresa_fuso: string;
    funcionario_id: number | null;
    // Endereço da miniatura (GET /api/perfil/avatar), nunca a imagem.
    avatar: string | null;
    nome: string;
    senha_provisoria: number;
}

export interface NovaConta {
    nomeEmpresa: string;
    cnpj: string;
    nomeAdmin: string;
    email: string;
    senhaCripto: string;
}

export const emailJaCadastrado = async (email: string): Promise<boolean> => {
    const [usuarios] = await db.query<RowDataPacket[]>('SELECT id FROM usuarios WHERE email = ?', [email]);
    return usuarios.length > 0;
};

// A empresa e o administrador entram juntos ou nenhum dos dois entra. As chaves únicas de
// usuarios.email e empresas.cnpj recusam (ER_DUP_ENTRY) o cadastro que perdeu a corrida.
export const criarEmpresaComAdministrador = async ({ nomeEmpresa, cnpj, nomeAdmin, email, senhaCripto }: NovaConta): Promise<void> => {
    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        const [empresa] = await conexao.query<ResultSetHeader>('INSERT INTO empresas (nome, cnpj) VALUES (?, ?)', [nomeEmpresa, cnpj]);
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
    const [usuarios] = await db.query<Usuario[]>(
        // Colunas explícitas: o login não precisa do avatar, que pesa megabytes.
        'SELECT id, nome, senha, perfil, empresa_id, funcionario_id, sessao_versao, senha_provisoria FROM usuarios WHERE email = ?',
        [email]
    );
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
        `SELECT u.id, u.perfil, u.empresa_id, e.nome AS empresa_nome, e.fuso AS empresa_fuso, u.funcionario_id, ${urlDoAvatarSql('u')} AS avatar, u.senha_provisoria,
                COALESCE(f.nome, u.nome) AS nome
         FROM usuarios u
         JOIN empresas e ON e.id = u.empresa_id
         LEFT JOIN funcionarios f ON f.id = u.funcionario_id AND f.empresa_id = u.empresa_id
         WHERE u.id = ?`,
        [usuarioId]
    );
    return linhas[0];
};

// O pedido de redefinição: só o hash do token fica no banco. Um pedido novo invalida os anteriores
// que ainda não foram usados, então só o link do último e-mail vale.
export const criarRedefinicao = async (usuarioId: number, tokenHash: string, expiraEm: number, agora: number): Promise<void> => {
    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        await conexao.query(
            'UPDATE redefinicoes_de_senha SET usado_em = FROM_UNIXTIME(?) WHERE usuario_id = ? AND usado_em IS NULL',
            [agora, usuarioId]
        );
        await conexao.query(
            'INSERT INTO redefinicoes_de_senha (usuario_id, token_hash, expira_em) VALUES (?, ?, FROM_UNIXTIME(?))',
            [usuarioId, tokenHash, expiraEm]
        );
        await conexao.commit();
    } catch (erro) {
        await conexao.rollback().catch(() => {});
        throw erro;
    } finally {
        conexao.release();
    }
};

interface PedidoDeRedefinicao extends RowDataPacket {
    id: number;
    usuario_id: number;
    funcionario_status: string | null;
}

// Consome o token e grava a senha numa transação só: o token vale uma vez, mesmo que duas requisições
// cheguem juntas (a linha fica travada). Devolve false se o token não existe, já foi usado, expirou ou
// é de quem foi desligado. Subir a versão da sessão encerra todas as sessões abertas com a senha esquecida.
export const consumirRedefinicao = async (tokenHash: string, agora: number, senhaCripto: string): Promise<boolean> => {
    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        const [pedidos] = await conexao.query<PedidoDeRedefinicao[]>(
            `SELECT r.id, r.usuario_id, f.status AS funcionario_status
             FROM redefinicoes_de_senha r
             JOIN usuarios u ON u.id = r.usuario_id
             LEFT JOIN funcionarios f ON f.id = u.funcionario_id AND f.empresa_id = u.empresa_id
             WHERE r.token_hash = ? AND r.usado_em IS NULL AND r.expira_em > FROM_UNIXTIME(?)
             FOR UPDATE OF r`,
            [tokenHash, agora]
        );
        const pedido = pedidos[0];
        if (!pedido || pedido.funcionario_status === 'Inativo') {
            await conexao.rollback();
            return false;
        }
        await conexao.query(
            'UPDATE usuarios SET senha = ?, senha_provisoria = FALSE, sessao_versao = sessao_versao + 1 WHERE id = ?',
            [senhaCripto, pedido.usuario_id]
        );
        await conexao.query('UPDATE redefinicoes_de_senha SET usado_em = FROM_UNIXTIME(?) WHERE id = ?', [agora, pedido.id]);
        await conexao.commit();
        return true;
    } catch (erro) {
        await conexao.rollback().catch(() => {});
        throw erro;
    } finally {
        conexao.release();
    }
};
