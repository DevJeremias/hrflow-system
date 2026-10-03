// Todo o SQL das contas de acesso. Devolve linhas como o MySQL as entrega e não conhece HTTP nem
// regra de negócio. As consultas rodam no pool ou, dentro de emTransacao, numa conexão reservada.
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';

// Uma conta como a lista mostra: o nome é o do cadastro do funcionário quando há vínculo.
export interface UsuarioListado extends RowDataPacket {
    id: number;
    nome: string;
    email: string;
    perfil: string;
    funcionario_id: number | null;
    funcionario_status: string | null;
    senha_provisoria: number;
    criado_em: Date;
}

export interface NovoUsuario {
    nome: string;
    email: string;
    perfil: string;
    senhaCriptografada: string;
    empresaId: number;
}

export interface AlteracaoDoUsuario {
    id: number;
    empresaId: number;
    nome?: string;
    email?: string;
    perfil?: string;
}

const SELECT_LISTADO = `SELECT u.id, COALESCE(f.nome, u.nome) AS nome, u.email, u.perfil, u.funcionario_id,
                               f.status AS funcionario_status, u.senha_provisoria, u.criado_em
                        FROM usuarios u
                        LEFT JOIN funcionarios f ON f.id = u.funcionario_id AND f.empresa_id = u.empresa_id`;

const criarRepositorio = (executor: Connection) => ({
    async listarDaEmpresa(empresaId: number, limite: number, deslocamento: number): Promise<UsuarioListado[]> {
        const [linhas] = await executor.query<UsuarioListado[]>(
            `${SELECT_LISTADO} WHERE u.empresa_id = ? ORDER BY u.id LIMIT ? OFFSET ?`,
            [empresaId, limite, deslocamento]
        );
        return linhas;
    },

    async contarDaEmpresa(empresaId: number): Promise<number> {
        const [[{ total }]] = await executor.query<(RowDataPacket & { total: number })[]>(
            'SELECT COUNT(*) AS total FROM usuarios WHERE empresa_id = ?', [empresaId]
        );
        return total;
    },

    // `travar` segura a linha até o fim da transação: duas edições da mesma conta não se atropelam.
    async buscarDaEmpresa(id: number, empresaId: number, travar = false): Promise<UsuarioListado | undefined> {
        const [linhas] = await executor.query<UsuarioListado[]>(
            `${SELECT_LISTADO} WHERE u.id = ? AND u.empresa_id = ?${travar ? ' FOR UPDATE' : ''}`,
            [id, empresaId]
        );
        return linhas[0];
    },

    // O e-mail do login é único em todas as empresas; `exceto` é a própria conta, na edição.
    async emailEmUso(email: string, exceto?: number): Promise<boolean> {
        const [linhas] = await executor.query<RowDataPacket[]>(
            'SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, exceto ?? 0]
        );
        return linhas.length > 0;
    },

    // A conta nasce com a senha provisória: o titular a troca no primeiro acesso.
    async inserir({ nome, email, perfil, senhaCriptografada, empresaId }: NovoUsuario): Promise<number> {
        const [resultado] = await executor.query<ResultSetHeader>(
            `INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, senha_provisoria)
             VALUES (?, ?, ?, ?, ?, TRUE)`,
            [nome, email, senhaCriptografada, perfil, empresaId]
        );
        return resultado.insertId;
    },

    // Só muda o que veio; subir a versão da sessão derruba os tokens que ainda carregam o perfil e o nome antigos.
    async atualizar({ id, empresaId, nome, email, perfil }: AlteracaoDoUsuario): Promise<void> {
        await executor.query(
            `UPDATE usuarios
             SET nome = COALESCE(?, nome), email = COALESCE(?, email), perfil = COALESCE(?, perfil),
                 sessao_versao = sessao_versao + 1
             WHERE id = ? AND empresa_id = ?`,
            [nome ?? null, email ?? null, perfil ?? null, id, empresaId]
        );
    },

    // Troca a senha por uma provisória e derruba as sessões abertas.
    async definirSenhaProvisoria(id: number, empresaId: number, senhaCriptografada: string): Promise<void> {
        await executor.query(
            `UPDATE usuarios SET senha = ?, senha_provisoria = TRUE, sessao_versao = sessao_versao + 1
             WHERE id = ? AND empresa_id = ?`,
            [senhaCriptografada, id, empresaId]
        );
    },
});

export type RepositorioDeUsuarios = ReturnType<typeof criarRepositorio>;

// Roda `trabalho` numa conexão em transação: confirma se terminar, desfaz se lançar erro.
// O repositório recebido usa essa conexão.
export const emTransacao = async <T>(trabalho: (repositorio: RepositorioDeUsuarios) => Promise<T>): Promise<T> => {
    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        const resultado = await trabalho(criarRepositorio(conexao));
        await conexao.commit();
        return resultado;
    } catch (erro) {
        await conexao.rollback().catch(() => {});
        throw erro;
    } finally {
        conexao.release();
    }
};

export const { listarDaEmpresa, contarDaEmpresa } = criarRepositorio(db);
