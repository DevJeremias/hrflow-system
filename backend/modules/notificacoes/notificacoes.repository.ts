// Todo o SQL das notificações. Devolve linhas como o MySQL as entrega e não conhece HTTP nem regra de
// negócio. Toda consulta parte do usuário e da empresa do token: ninguém lê o aviso de outra pessoa.
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';

export interface NotificacaoGravada extends RowDataPacket {
    id: number;
    tipo: string;
    titulo: string;
    mensagem: string;
    link: string | null;
    lida: number;
    criada: number;
}

export interface DestinatarioDoAviso extends RowDataPacket {
    id: number;
    nome: string;
    email: string;
}

export interface NovoAviso {
    tipo: string;
    titulo: string;
    mensagem: string;
    link: string | null;
}

export const listar = async (usuarioId: number, empresaId: number, limite: number): Promise<NotificacaoGravada[]> => {
    const [linhas] = await db.query<NotificacaoGravada[]>(
        `SELECT id, tipo, titulo, mensagem, link, lida_em IS NOT NULL AS lida, UNIX_TIMESTAMP(criada_em) AS criada
         FROM notificacoes
         WHERE usuario_id = ? AND empresa_id = ?
         ORDER BY id DESC
         LIMIT ?`,
        [usuarioId, empresaId, limite]
    );
    return linhas;
};

export const contarNaoLidas = async (usuarioId: number, empresaId: number): Promise<number> => {
    const [[{ total }]] = await db.query<(RowDataPacket & { total: number })[]>(
        'SELECT COUNT(*) AS total FROM notificacoes WHERE usuario_id = ? AND empresa_id = ? AND lida_em IS NULL',
        [usuarioId, empresaId]
    );
    return total;
};

// Devolve se o aviso existe para o usuário. Já lida, continua lida (a primeira leitura vale). O
// affectedRows do mysql2 conta as linhas encontradas, não só as alteradas.
export const marcarLida = async (id: number, usuarioId: number, empresaId: number): Promise<boolean> => {
    const [resultado] = await db.query<ResultSetHeader>(
        'UPDATE notificacoes SET lida_em = COALESCE(lida_em, CURRENT_TIMESTAMP) WHERE id = ? AND usuario_id = ? AND empresa_id = ?',
        [id, usuarioId, empresaId]
    );
    return resultado.affectedRows > 0;
};

export const marcarTodasLidas = async (usuarioId: number, empresaId: number): Promise<void> => {
    await db.query(
        'UPDATE notificacoes SET lida_em = CURRENT_TIMESTAMP WHERE usuario_id = ? AND empresa_id = ? AND lida_em IS NULL',
        [usuarioId, empresaId]
    );
};

// As contas de acesso ligadas a estes colaboradores; colaborador sem conta não tem a quem avisar.
export const destinatariosDosColaboradores = async (empresaId: number, funcionarioIds: number[]): Promise<DestinatarioDoAviso[]> => {
    if (funcionarioIds.length === 0) return [];
    const [linhas] = await db.query<DestinatarioDoAviso[]>(
        'SELECT id, nome, email FROM usuarios WHERE empresa_id = ? AND funcionario_id IN (?) ORDER BY id',
        [empresaId, funcionarioIds]
    );
    return linhas;
};

export const inserir = async (empresaId: number, usuarioIds: number[], aviso: NovoAviso): Promise<void> => {
    if (usuarioIds.length === 0) return;
    await db.query(
        'INSERT INTO notificacoes (empresa_id, usuario_id, tipo, titulo, mensagem, link) VALUES ?',
        [usuarioIds.map((usuarioId) => [empresaId, usuarioId, aviso.tipo, aviso.titulo, aviso.mensagem, aviso.link])]
    );
};
