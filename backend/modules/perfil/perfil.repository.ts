// Todo o SQL do perfil. Devolve linhas como o MySQL as entrega e não conhece HTTP nem regra de
// negócio. As consultas rodam no pool ou, dentro de emTransacao, numa conexão reservada.
import type { Connection, RowDataPacket } from 'mysql2/promise';
import db from '../../config/db.js';

// Tudo o que depende do vínculo com o funcionário vem null quando ele não existe.
export interface PerfilDoUsuario extends RowDataPacket {
    perfil: string;
    nome: string;
    email: string;
    avatar: string | null;
    funcionario_id: number | null;
    telefone: string | null;
    cpf: string | null;
    data_nascimento: string | null;
    data_admissao: string | null;
    endereco: string | null;
    tipo_contrato: string | null;
    nivel: string | null;
    banco: string | null;
    agencia: string | null;
    conta: string | null;
    tipo_conta: string | null;
    cargo: string | null;
    departamento: string | null;
}

export interface DadosDoUsuario {
    usuarioId: number;
    empresaId: number;
    nome: string;
    email: string;
    avatar: string | null;
}

export interface DadosDoFuncionario {
    funcionarioId: number;
    empresaId: number;
    nome: string;
    email: string;
    telefone: string | null;
    avatar: string | null;
}

const criarRepositorio = (executor: Connection) => ({
    // O vínculo com o funcionário só vale dentro da mesma empresa do usuário.
    async perfilDoUsuario(usuarioId: number, empresaId: number): Promise<PerfilDoUsuario | undefined> {
        const [linhas] = await executor.query<PerfilDoUsuario[]>(
            `SELECT u.perfil, COALESCE(f.nome, u.nome) AS nome, u.email, u.avatar, f.id AS funcionario_id,
                    f.telefone, f.cpf,
                    DATE_FORMAT(f.data_nascimento, '%Y-%m-%d') AS data_nascimento,
                    DATE_FORMAT(f.data_admissao, '%Y-%m-%d') AS data_admissao,
                    f.endereco, f.tipo_contrato, COALESCE(f.nivel, c.nivel) AS nivel,
                    f.banco, f.agencia, f.conta, f.tipo_conta,
                    c.nome AS cargo, d.nome AS departamento
             FROM usuarios u
             LEFT JOIN funcionarios f ON f.id = u.funcionario_id AND f.empresa_id = u.empresa_id
             LEFT JOIN cargos c ON c.id = f.cargo_id AND c.empresa_id = f.empresa_id
             LEFT JOIN departamentos d ON d.id = f.departamento_id AND d.empresa_id = f.empresa_id
             WHERE u.id = ? AND u.empresa_id = ?`,
            [usuarioId, empresaId]
        );
        return linhas[0];
    },

    async emailEmUsoPorOutro(email: string, usuarioId: number): Promise<boolean> {
        const [linhas] = await executor.query<RowDataPacket[]>('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, usuarioId]);
        return linhas.length > 0;
    },

    async atualizarUsuario({ usuarioId, empresaId, nome, email, avatar }: DadosDoUsuario): Promise<void> {
        await executor.query(
            'UPDATE usuarios SET email = ?, nome = ?, avatar = ? WHERE id = ? AND empresa_id = ?',
            [email, nome, avatar, usuarioId, empresaId]
        );
    },

    async atualizarFuncionario({ funcionarioId, empresaId, nome, email, telefone, avatar }: DadosDoFuncionario): Promise<void> {
        await executor.query(
            'UPDATE funcionarios SET email = ?, nome = ?, telefone = ?, avatar = ? WHERE id = ? AND empresa_id = ?',
            [email, nome, telefone, avatar, funcionarioId, empresaId]
        );
    },

    async hashDaSenha(usuarioId: number): Promise<string | undefined> {
        const [linhas] = await executor.query<(RowDataPacket & { senha: string })[]>('SELECT senha FROM usuarios WHERE id = ?', [usuarioId]);
        return linhas[0]?.senha;
    },

    // Subir a versão da sessão revoga os tokens emitidos com a senha anterior.
    async trocarSenha(usuarioId: number, hash: string): Promise<void> {
        await executor.query('UPDATE usuarios SET senha = ?, sessao_versao = sessao_versao + 1 WHERE id = ?', [hash, usuarioId]);
    },
});

export type RepositorioDoPerfil = ReturnType<typeof criarRepositorio>;

// Roda `trabalho` numa conexão em transação: confirma se terminar, desfaz se lançar erro.
// O repositório recebido usa essa conexão.
export const emTransacao = async <T>(trabalho: (repositorio: RepositorioDoPerfil) => Promise<T>): Promise<T> => {
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

export const { perfilDoUsuario, hashDaSenha, trocarSenha } = criarRepositorio(db);
