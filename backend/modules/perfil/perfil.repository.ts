// Todo o SQL do perfil. Devolve linhas como o MySQL as entrega e não conhece HTTP nem regra de
// negócio. As consultas rodam no pool ou, dentro de emTransacao, numa conexão reservada.
import type { Connection, RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';
import { gravarAuditoria } from '../../shared/utils/auditar.ts';
import type { Autoria, EventoDeAuditoria } from '../../shared/utils/auditar.ts';
import { urlDoAvatarSql } from '../../shared/utils/avatar.ts';

// Tudo o que depende do vínculo com o funcionário vem null quando ele não existe.
export interface PerfilDoUsuario extends RowDataPacket {
    perfil: string;
    nome: string;
    email: string;
    // Endereço da miniatura (GET /api/perfil/avatar), nunca a imagem.
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
    // Quem a empresa indicou como encarregado pelo tratamento de dados (LGPD).
    encarregado_nome: string | null;
    encarregado_email: string | null;
}

// O que fazer com o avatar gravado: undefined mantém, null remove, e uma imagem nova substitui o
// original e a miniatura juntos.
export type MudancaDeAvatar = undefined | null | { tipo: string; original: Buffer; miniatura: Buffer };

// O que a edição dos próprios dados grava na conta de acesso e no cadastro. Só entra o que mudou.
export interface DadosDaConta {
    nome?: string;
    email?: string;
}

export interface DadosDoCadastro {
    nome?: string;
    email?: string;
    telefone?: string | null;
    endereco?: string | null;
    banco?: string | null;
    agencia?: string | null;
    conta?: string | null;
    tipo_conta?: string | null;
}

const COLUNAS_DO_CADASTRO = ['nome', 'email', 'telefone', 'endereco', 'banco', 'agencia', 'conta', 'tipo_conta'] as const;

export interface AvatarDoUsuario extends RowDataPacket {
    miniatura: Buffer | null;
}

const criarRepositorio = (executor: Connection) => ({
    // O vínculo com o funcionário só vale dentro da mesma empresa do usuário. `travar` segura a conta
    // até o fim da transação.
    async perfilDoUsuario(usuarioId: number, empresaId: number, travar = false): Promise<PerfilDoUsuario | undefined> {
        const [linhas] = await executor.query<PerfilDoUsuario[]>(
            `SELECT u.perfil, COALESCE(f.nome, u.nome) AS nome, u.email, ${urlDoAvatarSql('u')} AS avatar, f.id AS funcionario_id,
                    f.telefone, f.cpf,
                    DATE_FORMAT(f.data_nascimento, '%Y-%m-%d') AS data_nascimento,
                    DATE_FORMAT(f.data_admissao, '%Y-%m-%d') AS data_admissao,
                    COALESCE(
                        NULLIF(CONCAT_WS(', ', NULLIF(f.logradouro, ''), NULLIF(f.numero, ''), NULLIF(f.complemento, ''), NULLIF(f.bairro, ''),
                                         NULLIF(CONCAT_WS('/', NULLIF(f.cidade, ''), NULLIF(f.uf, '')), ''), NULLIF(f.cep, '')), ''),
                        f.endereco) AS endereco,
                    f.tipo_contrato, COALESCE(f.nivel, c.nivel) AS nivel,
                    f.banco, f.agencia, f.conta, f.tipo_conta,
                    c.nome AS cargo, d.nome AS departamento,
                    e.encarregado_nome, e.encarregado_email
             FROM usuarios u
             JOIN empresas e ON e.id = u.empresa_id
             LEFT JOIN funcionarios f ON f.id = u.funcionario_id AND f.empresa_id = u.empresa_id
             LEFT JOIN cargos c ON c.id = f.cargo_id AND c.empresa_id = f.empresa_id
             LEFT JOIN departamentos d ON d.id = f.departamento_id AND d.empresa_id = f.empresa_id
             WHERE u.id = ? AND u.empresa_id = ?${travar ? ' FOR UPDATE OF u' : ''}`,
            [usuarioId, empresaId]
        );
        return linhas[0];
    },

    async emailEmUsoPorOutro(email: string, usuarioId: number): Promise<boolean> {
        const [linhas] = await executor.query<RowDataPacket[]>('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, usuarioId]);
        return linhas.length > 0;
    },

    // Trocar o e-mail de login revoga as sessões abertas, como trocar a senha. A versão da sessão vem
    // primeiro no SET porque o MySQL avalia as atribuições em ordem: depois de `email = ...` ela
    // compararia com o e-mail novo.
    async atualizarConta(usuarioId: number, empresaId: number, { nome, email }: DadosDaConta): Promise<void> {
        await executor.query(
            `UPDATE usuarios
             SET sessao_versao = sessao_versao + COALESCE(? <> email, 0), nome = COALESCE(?, nome), email = COALESCE(?, email)
             WHERE id = ? AND empresa_id = ?`,
            [email ?? null, nome ?? null, email ?? null, usuarioId, empresaId]
        );
    },

    // Só as colunas que vieram: as chaves são as do tipo, nunca do cliente.
    async atualizarCadastro(funcionarioId: number, empresaId: number, dados: DadosDoCadastro): Promise<void> {
        const colunas = COLUNAS_DO_CADASTRO.filter((coluna) => dados[coluna] !== undefined);
        if (colunas.length === 0) return;
        await executor.query(
            `UPDATE funcionarios SET ${colunas.map((coluna) => `${coluna} = ?`).join(', ')} WHERE id = ? AND empresa_id = ?`,
            [...colunas.map((coluna) => dados[coluna]), funcionarioId, empresaId]
        );
    },

    // O original e a miniatura trocam juntos; a data do upload muda a URL da miniatura.
    async gravarAvatar(usuarioId: number, { tipo, original, miniatura }: NonNullable<MudancaDeAvatar>): Promise<void> {
        await executor.query(
            `INSERT INTO avatares (usuario_id, tipo, imagem, miniatura) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE tipo = VALUES(tipo), imagem = VALUES(imagem), miniatura = VALUES(miniatura), atualizado_em = CURRENT_TIMESTAMP(3)`,
            [usuarioId, tipo, original, miniatura]
        );
    },

    async removerAvatar(usuarioId: number): Promise<void> {
        await executor.query('DELETE FROM avatares WHERE usuario_id = ?', [usuarioId]);
    },

    // Sem ler o original: ele só é buscado quando falta a miniatura.
    async avatarDoUsuario(usuarioId: number, empresaId: number): Promise<AvatarDoUsuario | undefined> {
        const [linhas] = await executor.query<AvatarDoUsuario[]>(
            `SELECT a.miniatura FROM avatares a JOIN usuarios u ON u.id = a.usuario_id WHERE a.usuario_id = ? AND u.empresa_id = ?`,
            [usuarioId, empresaId]
        );
        return linhas[0];
    },

    async avatarOriginal(usuarioId: number): Promise<Buffer | null> {
        const [linhas] = await executor.query<(RowDataPacket & { imagem: Buffer })[]>('SELECT imagem FROM avatares WHERE usuario_id = ?', [usuarioId]);
        return linhas[0]?.imagem ?? null;
    },

    // Só preenche quem ainda não tem miniatura: um upload concorrente não é sobrescrito.
    async gravarMiniatura(usuarioId: number, miniatura: Buffer): Promise<void> {
        await executor.query('UPDATE avatares SET miniatura = ? WHERE usuario_id = ? AND miniatura IS NULL', [miniatura, usuarioId]);
    },

    async hashDaSenha(usuarioId: number): Promise<string | undefined> {
        const [linhas] = await executor.query<(RowDataPacket & { senha: string })[]>('SELECT senha FROM usuarios WHERE id = ?', [usuarioId]);
        return linhas[0]?.senha;
    },

    // Subir a versão da sessão revoga os tokens emitidos com a senha anterior. A senha escolhida
    // pela própria pessoa deixa de ser provisória.
    async trocarSenha(usuarioId: number, hash: string): Promise<void> {
        await executor.query('UPDATE usuarios SET senha = ?, senha_provisoria = FALSE, sessao_versao = sessao_versao + 1 WHERE id = ?', [hash, usuarioId]);
    },

    auditar(autoria: Autoria, evento: EventoDeAuditoria): Promise<void> {
        return gravarAuditoria(executor, autoria, evento);
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

export const { perfilDoUsuario, hashDaSenha, avatarDoUsuario, avatarOriginal, gravarMiniatura } = criarRepositorio(db);
