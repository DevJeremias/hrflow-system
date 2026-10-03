// Todo o SQL de ausências. Devolve linhas como o MySQL as entrega (instantes em segundos Unix, dias
// como 'AAAA-MM-DD') e não conhece HTTP nem regra de negócio. As consultas rodam no pool ou, dentro
// de emTransacao, numa conexão reservada.
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';
import type { StatusDeAusencia, TipoDeAusencia } from './ausencias.regras.ts';

export interface ColaboradorDaAusencia extends RowDataPacket {
    id: number;
    // 'AAAA-MM-DD', ou null quando a admissão não foi informada.
    admissao: string | null;
}

export interface PeriodoEmAberto extends RowDataPacket {
    inicio: string;
    fim: string;
}

export interface AusenciaDaEmpresa extends RowDataPacket {
    id: number;
    funcionario_id: number;
    nome_funcionario: string;
    tipo: TipoDeAusencia;
    inicio: string;
    fim: string;
    observacao: string;
    status: StatusDeAusencia;
    resposta: string | null;
    decidido_por_nome: string | null;
    decidido: number | null;
    criado: number;
    anexo_nome: string | null;
    // Perfil da conta de acesso do colaborador; null se não há.
    perfil_da_conta: string | null;
}

export interface AusenciaTravada extends RowDataPacket {
    id: number;
    funcionario_id: number;
    status: StatusDeAusencia;
}

export interface AnexoGravado extends RowDataPacket {
    funcionario_id: number;
    nome: string;
    tipo_mime: string;
    conteudo: Buffer;
}

export interface FeriasDoPeriodo extends RowDataPacket {
    funcionario_id: number;
    inicio: string;
    fim: string;
}

export interface NovaAusencia {
    empresaId: number;
    funcionarioId: number;
    tipo: TipoDeAusencia;
    inicio: string;
    fim: string;
    observacao: string;
}

export interface NovoAnexo {
    ausenciaId: number;
    empresaId: number;
    nome: string;
    tipo: string;
    conteudo: Buffer;
}

export interface FiltroDeAusencias {
    empresaId: number;
    status: StatusDeAusencia | null;
    funcionarioId: number | null;
    limite: number;
    deslocamento: number;
}

export interface DecisaoRegistrada {
    id: number;
    empresaId: number;
    status: 'Aprovada' | 'Recusada';
    resposta: string | null;
    decididoPor: number;
}

const DIAS = "DATE_FORMAT(a.data_inicio, '%Y-%m-%d') AS inicio, DATE_FORMAT(a.data_fim, '%Y-%m-%d') AS fim";

// Colunas e junções que as listas e a leitura de uma ausência compartilham.
const SELECT_DA_AUSENCIA = `SELECT a.id, a.funcionario_id, f.nome AS nome_funcionario, a.tipo, ${DIAS},
                    a.observacao, a.status, a.resposta, ud.nome AS decidido_por_nome,
                    UNIX_TIMESTAMP(a.decidido_em) AS decidido, UNIX_TIMESTAMP(a.criado_em) AS criado,
                    x.nome AS anexo_nome,
                    (SELECT u.perfil FROM usuarios u WHERE u.funcionario_id = a.funcionario_id AND u.empresa_id = a.empresa_id LIMIT 1) AS perfil_da_conta
             FROM ausencias a
             JOIN funcionarios f ON f.id = a.funcionario_id AND f.empresa_id = a.empresa_id
             LEFT JOIN usuarios ud ON ud.id = a.decidido_por
             LEFT JOIN ausencia_anexos x ON x.ausencia_id = a.id AND x.empresa_id = a.empresa_id`;

const criarRepositorio = (executor: Connection) => ({
    // Com `travar`, a linha do colaborador fica bloqueada até o fim da transação: dois pedidos
    // simultâneos do mesmo colaborador (duplo clique, duas abas) não leem o mesmo saldo.
    async colaborador(funcionarioId: number, empresaId: number, { travar = false } = {}): Promise<ColaboradorDaAusencia | undefined> {
        const [linhas] = await executor.query<ColaboradorDaAusencia[]>(
            `SELECT id, DATE_FORMAT(data_admissao, '%Y-%m-%d') AS admissao FROM funcionarios WHERE id = ? AND empresa_id = ?${travar ? ' FOR UPDATE' : ''}`,
            [funcionarioId, empresaId]
        );
        return linhas[0];
    },

    // Os períodos que já ocupam o colaborador: pedidos em análise e aprovados.
    async periodosEmAberto(funcionarioId: number): Promise<PeriodoEmAberto[]> {
        const [linhas] = await executor.query<PeriodoEmAberto[]>(
            `SELECT ${DIAS} FROM ausencias a WHERE a.funcionario_id = ? AND a.status IN ('Pendente', 'Aprovada')`,
            [funcionarioId]
        );
        return linhas;
    },

    // Dias de férias já pedidos, aprovados e em análise (as recusadas não consomem saldo).
    async feriasPedidas(funcionarioId: number): Promise<{ aprovadas: number; emAnalise: number }> {
        const [linhas] = await executor.query<(RowDataPacket & { status: StatusDeAusencia; dias: string })[]>(
            `SELECT status, SUM(DATEDIFF(data_fim, data_inicio) + 1) AS dias
             FROM ausencias WHERE funcionario_id = ? AND tipo = 'Férias' AND status IN ('Pendente', 'Aprovada') GROUP BY status`,
            [funcionarioId]
        );
        const dias = (status: StatusDeAusencia) => Number(linhas.find((l) => l.status === status)?.dias ?? 0);
        return { aprovadas: dias('Aprovada'), emAnalise: dias('Pendente') };
    },

    async inserir(a: NovaAusencia): Promise<number> {
        const [resultado] = await executor.query<ResultSetHeader>(
            'INSERT INTO ausencias (empresa_id, funcionario_id, tipo, data_inicio, data_fim, observacao) VALUES (?, ?, ?, ?, ?, ?)',
            [a.empresaId, a.funcionarioId, a.tipo, a.inicio, a.fim, a.observacao]
        );
        return resultado.insertId;
    },

    async inserirAnexo(a: NovoAnexo): Promise<void> {
        await executor.query(
            'INSERT INTO ausencia_anexos (ausencia_id, empresa_id, nome, tipo_mime, tamanho, conteudo) VALUES (?, ?, ?, ?, ?, ?)',
            [a.ausenciaId, a.empresaId, a.nome, a.tipo, a.conteudo.length, a.conteudo]
        );
    },

    async ausenciaDaEmpresa(id: number, empresaId: number): Promise<AusenciaDaEmpresa | undefined> {
        const [linhas] = await executor.query<AusenciaDaEmpresa[]>(`${SELECT_DA_AUSENCIA} WHERE a.id = ? AND a.empresa_id = ?`, [id, empresaId]);
        return linhas[0];
    },

    // Bloqueia a linha até o fim da transação: duas decisões sobre o mesmo pedido não se atropelam.
    async travarAusencia(id: number, empresaId: number): Promise<AusenciaTravada | undefined> {
        const [linhas] = await executor.query<AusenciaTravada[]>(
            'SELECT id, funcionario_id, status FROM ausencias WHERE id = ? AND empresa_id = ? FOR UPDATE',
            [id, empresaId]
        );
        return linhas[0];
    },

    // Do pedido mais novo ao mais antigo.
    async ausenciasDoColaborador(funcionarioId: number, empresaId: number): Promise<AusenciaDaEmpresa[]> {
        const [linhas] = await executor.query<AusenciaDaEmpresa[]>(
            `${SELECT_DA_AUSENCIA} WHERE a.funcionario_id = ? AND a.empresa_id = ? ORDER BY a.criado_em DESC, a.id DESC`,
            [funcionarioId, empresaId]
        );
        return linhas;
    },

    // A fila do RH: os pendentes primeiro, do mais antigo ao mais novo (quem espera há mais tempo
    // aparece antes); depois as decididas, da mais recente à mais antiga. O id ordena por criação
    // e desempata pedidos do mesmo segundo.
    async ausenciasDaEmpresa({ empresaId, status, funcionarioId, limite, deslocamento }: FiltroDeAusencias): Promise<AusenciaDaEmpresa[]> {
        const { onde, valores } = condicoes({ empresaId, status, funcionarioId });
        const [linhas] = await executor.query<AusenciaDaEmpresa[]>(
            `${SELECT_DA_AUSENCIA} WHERE ${onde}
             ORDER BY (a.status = 'Pendente') DESC, CASE WHEN a.status = 'Pendente' THEN a.id END ASC, a.id DESC
             LIMIT ? OFFSET ?`,
            [...valores, limite, deslocamento]
        );
        return linhas;
    },

    async contarDaEmpresa(filtro: Pick<FiltroDeAusencias, 'empresaId' | 'status' | 'funcionarioId'>): Promise<number> {
        const { onde, valores } = condicoes(filtro);
        const [[{ total }]] = await executor.query<(RowDataPacket & { total: number })[]>(`SELECT COUNT(*) AS total FROM ausencias a WHERE ${onde}`, valores);
        return total;
    },

    async decidir({ id, empresaId, status, resposta, decididoPor }: DecisaoRegistrada): Promise<void> {
        await executor.query(
            'UPDATE ausencias SET status = ?, resposta = ?, decidido_por = ?, decidido_em = CURRENT_TIMESTAMP WHERE id = ? AND empresa_id = ?',
            [status, resposta, decididoPor, id, empresaId]
        );
    },

    async anexoDaAusencia(id: number, empresaId: number): Promise<AnexoGravado | undefined> {
        const [linhas] = await executor.query<AnexoGravado[]>(
            `SELECT a.funcionario_id, x.nome, x.tipo_mime, x.conteudo
             FROM ausencia_anexos x JOIN ausencias a ON a.id = x.ausencia_id AND a.empresa_id = x.empresa_id
             WHERE x.ausencia_id = ? AND x.empresa_id = ?`,
            [id, empresaId]
        );
        return linhas[0];
    },

    // Férias aprovadas que tocam o intervalo [de, ate] (a folha de uma competência).
    async feriasAprovadasNoPeriodo(empresaId: number, de: string, ate: string): Promise<FeriasDoPeriodo[]> {
        const [linhas] = await executor.query<FeriasDoPeriodo[]>(
            `SELECT a.funcionario_id, ${DIAS} FROM ausencias a
             WHERE a.empresa_id = ? AND a.tipo = 'Férias' AND a.status = 'Aprovada' AND a.data_inicio <= ? AND a.data_fim >= ?`,
            [empresaId, ate, de]
        );
        return linhas;
    },
});

const condicoes = ({ empresaId, status, funcionarioId }: Pick<FiltroDeAusencias, 'empresaId' | 'status' | 'funcionarioId'>) => {
    const onde = ['a.empresa_id = ?'];
    const valores: Array<number | string> = [empresaId];
    if (status) {
        onde.push('a.status = ?');
        valores.push(status);
    }
    if (funcionarioId) {
        onde.push('a.funcionario_id = ?');
        valores.push(funcionarioId);
    }
    return { onde: onde.join(' AND '), valores };
};

export type RepositorioDeAusencias = ReturnType<typeof criarRepositorio>;

// Roda `trabalho` numa conexão em transação: confirma se terminar, desfaz se lançar erro.
// O repositório recebido usa essa conexão.
export const emTransacao = async <T>(trabalho: (repositorio: RepositorioDeAusencias) => Promise<T>): Promise<T> => {
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

export const { colaborador, feriasPedidas, ausenciaDaEmpresa, ausenciasDoColaborador, ausenciasDaEmpresa, contarDaEmpresa, anexoDaAusencia, feriasAprovadasNoPeriodo } = criarRepositorio(db);
