// Todo o SQL das solicitações de alteração cadastral. Devolve linhas como o MySQL as entrega e não
// conhece HTTP nem regra de negócio. As consultas rodam no pool ou, dentro de emTransacao, numa
// conexão reservada.
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';
import { gravarAuditoria } from '../../shared/utils/auditar.ts';
import type { Autoria, EventoDeAuditoria } from '../../shared/utils/auditar.ts';
import { CAMPOS_DO_PEDIDO } from './solicitacoes.schemas.ts';
import type { CampoDoPedido, StatusDaSolicitacao } from './solicitacoes.schemas.ts';

// A conta de quem pede e o que o cadastro dela guarda hoje. O nome é o do cadastro de colaborador
// quando há um, e os dados do cadastro vêm null para quem não tem.
export interface ContaDoSolicitante extends RowDataPacket {
    id: number;
    perfil: string;
    funcionario_id: number | null;
    senha: string;
    anonimizado_em: Date | null;
    nome: string;
    email: string;
    endereco: string | null;
    banco: string | null;
    agencia: string | null;
    conta: string | null;
    tipo_conta: string | null;
}

export interface SolicitacaoGravada extends RowDataPacket {
    id: number;
    usuario_id: number;
    funcionario_id: number | null;
    // JSON: o mysql2 já o entrega como objeto.
    alteracoes: Partial<Record<CampoDoPedido, string | null>>;
    anteriores: Partial<Record<CampoDoPedido, string | null>>;
    status: StatusDaSolicitacao;
    resposta: string | null;
    decidido_por_nome: string | null;
    decidido_em: number | null;
    criado_em: number;
    solicitante_nome: string;
    solicitante_perfil: string;
}

export interface FiltroDeSolicitacoes {
    empresaId: number;
    status: StatusDaSolicitacao | null;
    // O RH decide só pedidos de Colaboradores; o Administrador, os de todos.
    soColaboradores: boolean;
}

const SELECT_DA_SOLICITACAO = `SELECT s.id, s.usuario_id, s.funcionario_id, s.alteracoes, s.anteriores, s.status, s.resposta,
        d.nome AS decidido_por_nome, UNIX_TIMESTAMP(s.decidido_em) AS decidido_em, UNIX_TIMESTAMP(s.criado_em) AS criado_em,
        COALESCE(f.nome, u.nome) AS solicitante_nome, u.perfil AS solicitante_perfil
     FROM solicitacoes_alteracao s
     JOIN usuarios u ON u.id = s.usuario_id
     LEFT JOIN funcionarios f ON f.id = s.funcionario_id AND f.empresa_id = s.empresa_id
     LEFT JOIN usuarios d ON d.id = s.decidido_por`;

const criarRepositorio = (executor: Connection) => ({
    // `travar` segura a conta até o fim da transação: dois pedidos da mesma pessoa não se atropelam.
    async contaDoSolicitante(usuarioId: number, empresaId: number, travar = false): Promise<ContaDoSolicitante | undefined> {
        const [linhas] = await executor.query<ContaDoSolicitante[]>(
            `SELECT u.id, u.perfil, u.funcionario_id, u.senha, f.anonimizado_em, COALESCE(f.nome, u.nome) AS nome, u.email,
                    f.endereco, f.banco, f.agencia, f.conta, f.tipo_conta
             FROM usuarios u
             LEFT JOIN funcionarios f ON f.id = u.funcionario_id AND f.empresa_id = u.empresa_id
             WHERE u.id = ? AND u.empresa_id = ?${travar ? ' FOR UPDATE OF u' : ''}`,
            [usuarioId, empresaId]
        );
        return linhas[0];
    },

    async emailEmUsoPorOutro(email: string, usuarioId: number): Promise<boolean> {
        const [linhas] = await executor.query<RowDataPacket[]>('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, usuarioId]);
        return linhas.length > 0;
    },

    // Um pedido novo toma o lugar do pendente anterior da mesma conta.
    async cancelarPendentes(usuarioId: number, empresaId: number): Promise<void> {
        await executor.query(
            "UPDATE solicitacoes_alteracao SET status = 'cancelada' WHERE usuario_id = ? AND empresa_id = ? AND status = 'pendente'",
            [usuarioId, empresaId]
        );
    },

    async inserir(empresaId: number, usuarioId: number, funcionarioId: number | null, alteracoes: object, anteriores: object): Promise<number> {
        const [resultado] = await executor.query<ResultSetHeader>(
            `INSERT INTO solicitacoes_alteracao (empresa_id, usuario_id, funcionario_id, alteracoes, anteriores)
             VALUES (?, ?, ?, ?, ?)`,
            [empresaId, usuarioId, funcionarioId, JSON.stringify(alteracoes), JSON.stringify(anteriores)]
        );
        return resultado.insertId;
    },

    async buscar(id: number, empresaId: number, travar = false): Promise<SolicitacaoGravada | undefined> {
        const [linhas] = await executor.query<SolicitacaoGravada[]>(
            `${SELECT_DA_SOLICITACAO} WHERE s.id = ? AND s.empresa_id = ?${travar ? ' FOR UPDATE OF s' : ''}`,
            [id, empresaId]
        );
        return linhas[0];
    },

    async listarDaEmpresa({ empresaId, status, soColaboradores }: FiltroDeSolicitacoes, limite: number, deslocamento: number): Promise<SolicitacaoGravada[]> {
        const { onde, valores } = filtrar(empresaId, status, soColaboradores);
        const [linhas] = await executor.query<SolicitacaoGravada[]>(
            `${SELECT_DA_SOLICITACAO} WHERE ${onde} ORDER BY s.id DESC LIMIT ? OFFSET ?`,
            [...valores, limite, deslocamento]
        );
        return linhas;
    },

    async contarDaEmpresa({ empresaId, status, soColaboradores }: FiltroDeSolicitacoes): Promise<number> {
        const { onde, valores } = filtrar(empresaId, status, soColaboradores);
        const [[{ total }]] = await executor.query<(RowDataPacket & { total: number })[]>(
            `SELECT COUNT(*) AS total FROM solicitacoes_alteracao s JOIN usuarios u ON u.id = s.usuario_id WHERE ${onde}`, valores
        );
        return total;
    },

    async dasMinhas(usuarioId: number, empresaId: number): Promise<SolicitacaoGravada[]> {
        const [linhas] = await executor.query<SolicitacaoGravada[]>(
            `${SELECT_DA_SOLICITACAO} WHERE s.usuario_id = ? AND s.empresa_id = ? ORDER BY s.id DESC LIMIT 20`,
            [usuarioId, empresaId]
        );
        return linhas;
    },

    // Os campos de cadastro vão para o funcionário; só `campos` entra no SET (as chaves vêm do schema, nunca do cliente).
    async aplicarNoCadastro(funcionarioId: number, empresaId: number, campos: Partial<Record<CampoDoPedido, string | null>>): Promise<void> {
        // Só colunas conhecidas entram no SQL, mesmo que o JSON gravado traga outra chave.
        const nomes = Object.keys(campos).filter((nome) => (CAMPOS_DO_PEDIDO as readonly string[]).includes(nome));
        if (nomes.length === 0) return;
        await executor.query(
            `UPDATE funcionarios SET ${nomes.map((nome) => `${nome} = ?`).join(', ')} WHERE id = ? AND empresa_id = ?`,
            [...nomes.map((nome) => campos[nome as CampoDoPedido]), funcionarioId, empresaId]
        );
    },

    // Trocar o e-mail de login revoga as sessões abertas, como trocar a senha. A versão da sessão vem
    // primeiro no SET porque o MySQL avalia as atribuições em ordem: depois de `email = ...` ela
    // compararia com o e-mail novo.
    async aplicarNaConta(usuarioId: number, empresaId: number, { nome, email }: { nome?: string; email?: string }): Promise<void> {
        await executor.query(
            `UPDATE usuarios
             SET sessao_versao = sessao_versao + COALESCE(? <> email, 0), nome = COALESCE(?, nome), email = COALESCE(?, email)
             WHERE id = ? AND empresa_id = ?`,
            [email ?? null, nome ?? null, email ?? null, usuarioId, empresaId]
        );
    },

    async registrarDecisao(id: number, status: 'aprovada' | 'recusada', resposta: string | null, decididoPor: number): Promise<void> {
        await executor.query(
            'UPDATE solicitacoes_alteracao SET status = ?, resposta = ?, decidido_por = ?, decidido_em = CURRENT_TIMESTAMP WHERE id = ?',
            [status, resposta, decididoPor, id]
        );
    },

    auditar(autoria: Autoria, evento: EventoDeAuditoria): Promise<void> {
        return gravarAuditoria(executor, autoria, evento);
    },
});

const filtrar = (empresaId: number, status: StatusDaSolicitacao | null, soColaboradores: boolean) => {
    const condicoes = ['s.empresa_id = ?'];
    const valores: (string | number)[] = [empresaId];
    if (status) {
        condicoes.push('s.status = ?');
        valores.push(status);
    }
    if (soColaboradores) condicoes.push("u.perfil = 'Colaborador'");
    return { onde: condicoes.join(' AND '), valores };
};

export type RepositorioDeSolicitacoes = ReturnType<typeof criarRepositorio>;

// Roda `trabalho` numa conexão em transação: confirma se terminar, desfaz se lançar erro.
// O repositório recebido usa essa conexão.
export const emTransacao = async <T>(trabalho: (repositorio: RepositorioDeSolicitacoes) => Promise<T>): Promise<T> => {
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

export const { buscar, listarDaEmpresa, contarDaEmpresa, dasMinhas } = criarRepositorio(db);
