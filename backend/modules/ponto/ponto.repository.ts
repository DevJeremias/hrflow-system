// Todo o SQL do ponto. Devolve linhas como o MySQL as entrega (instantes em segundos Unix) e não
// conhece HTTP nem regra de negócio. As consultas rodam no pool ou, dentro de emTransacao, numa
// conexão reservada.
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';
import type { TipoRegistro } from './ponto.regras.ts';

export interface UltimoRegistro extends RowDataPacket {
    tipo_registro: TipoRegistro;
    instante: number;
}

export interface RegistroDoColaborador extends UltimoRegistro {
    id: number;
    observacao: string | null;
}

// latitude e longitude são DECIMAL: o mysql2 as entrega como texto.
export interface RegistroDaEmpresa extends RegistroDoColaborador {
    funcionario_id: number;
    empresa_id: number;
    latitude: string | null;
    longitude: string | null;
    nome_funcionario: string;
}

export interface JustificativaDoDia extends RowDataPacket {
    dia: string;
    texto: string;
}

export interface JustificativaDaEmpresa extends RowDataPacket {
    id: number;
    funcionario_id: number;
    nome_funcionario: string;
    date: string;
    note: string;
    criado: number;
    atualizado: number;
}

// Marcações da empresa em [inicio, fim) (segundos Unix), de todos os colaboradores ou só de
// `funcionarioId`, com `busca` sobre o nome. `limite` e `deslocamento` recortam a página.
export interface FiltroDePontosDaEmpresa {
    empresaId: number;
    inicio: number;
    fim: number;
    funcionarioId: number | null;
    busca: string | null;
    limite: number;
    deslocamento: number;
}

export interface NovoRegistro {
    funcionarioId: number;
    empresaId: number;
    tipo: TipoRegistro;
    latitude: number | null;
    longitude: number | null;
    instante: number;
    observacao: string;
}

export interface NovaJustificativa {
    empresaId: number;
    funcionarioId: number;
    data: string;
    texto: string;
}

export interface FiltroDeJustificativas {
    empresaId: number;
    de: string;
    ate: string;
    funcionarioId: number | null;
}

// O LIKE trata % e _ como curingas: o texto digitado vale literalmente.
const textoDeBusca = (busca: string): string => `%${busca.replace(/[\\%_]/g, '\\$&')}%`;

const condicoesDosPontos = ({ empresaId, inicio, fim, funcionarioId, busca }: FiltroDePontosDaEmpresa) => {
    const condicoes = ['p.empresa_id = ?', 'p.data_hora_oficial >= FROM_UNIXTIME(?)', 'p.data_hora_oficial < FROM_UNIXTIME(?)'];
    const valores: Array<number | string> = [empresaId, inicio, fim];
    if (funcionarioId) {
        condicoes.push('p.funcionario_id = ?');
        valores.push(funcionarioId);
    }
    if (busca) {
        condicoes.push('f.nome LIKE ?');
        valores.push(textoDeBusca(busca));
    }
    return { where: condicoes.join(' AND '), valores };
};

// Exportada para o teste conferir no EXPLAIN que a página usa idx_registro_pontos_empresa_data.
// A ordem inclui o id: sem desempate, marcações no mesmo segundo trocariam de página entre consultas.
export const consultaDosPontosDaEmpresa = (filtro: FiltroDePontosDaEmpresa) => {
    const { where, valores } = condicoesDosPontos(filtro);
    return {
        sql: `SELECT p.id, p.funcionario_id, p.empresa_id, p.tipo_registro, p.latitude, p.longitude, p.observacao,
                     UNIX_TIMESTAMP(p.data_hora_oficial) AS instante, f.nome as nome_funcionario
              FROM registro_pontos p
              JOIN funcionarios f ON p.funcionario_id = f.id
              WHERE ${where}
              ORDER BY p.data_hora_oficial DESC, p.id DESC
              LIMIT ? OFFSET ?`,
        valores: [...valores, filtro.limite, filtro.deslocamento],
    };
};

const criarRepositorio = (executor: Connection) => ({
    // Com `travar`, bloqueia a linha do colaborador até o fim da transação.
    async colaboradorExiste(funcionarioId: number | string, empresaId: number, { travar = false } = {}): Promise<boolean> {
        const [linhas] = await executor.query<RowDataPacket[]>(
            `SELECT id FROM funcionarios WHERE id = ? AND empresa_id = ?${travar ? ' FOR UPDATE' : ''}`,
            [funcionarioId, empresaId]
        );
        return linhas.length > 0;
    },

    async ultimoRegistroDoDia(funcionarioId: number, empresaId: number, inicio: number, fim: number): Promise<UltimoRegistro | undefined> {
        const [ultimos] = await executor.query<UltimoRegistro[]>(
            `SELECT tipo_registro, UNIX_TIMESTAMP(data_hora_oficial) AS instante
             FROM registro_pontos
             WHERE funcionario_id = ? AND empresa_id = ?
               AND data_hora_oficial >= FROM_UNIXTIME(?) AND data_hora_oficial < FROM_UNIXTIME(?)
             ORDER BY data_hora_oficial DESC, id DESC
             LIMIT 1`,
            [funcionarioId, empresaId, inicio, fim]
        );
        return ultimos[0];
    },

    async inserirRegistro({ funcionarioId, empresaId, tipo, latitude, longitude, instante, observacao }: NovoRegistro): Promise<number> {
        const [resultado] = await executor.query<ResultSetHeader>(
            `INSERT INTO registro_pontos
            (funcionario_id, empresa_id, tipo_registro, latitude, longitude, data_hora_oficial, observacao)
            VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?), ?)`,
            [funcionarioId, empresaId, tipo, latitude, longitude, instante, observacao]
        );
        return resultado.insertId;
    },

    // Registros do colaborador entre dois instantes, do mais antigo ao mais novo.
    async registrosDoPeriodo(funcionarioId: number | string, empresaId: number, inicio: number, fim: number): Promise<RegistroDoColaborador[]> {
        const [pontos] = await executor.query<RegistroDoColaborador[]>(
            `SELECT id, tipo_registro, UNIX_TIMESTAMP(data_hora_oficial) AS instante, observacao
             FROM registro_pontos
             WHERE funcionario_id = ? AND empresa_id = ?
               AND data_hora_oficial >= FROM_UNIXTIME(?) AND data_hora_oficial < FROM_UNIXTIME(?)
             ORDER BY data_hora_oficial ASC, id ASC`,
            [funcionarioId, empresaId, inicio, fim]
        );
        return pontos;
    },

    async registrosDaEmpresa(filtro: FiltroDePontosDaEmpresa): Promise<{ pontos: RegistroDaEmpresa[]; total: number }> {
        const { sql, valores } = consultaDosPontosDaEmpresa(filtro);
        const { where, valores: valoresDoTotal } = condicoesDosPontos(filtro);
        const [[pontos], [[{ total }]]] = await Promise.all([
            executor.query<RegistroDaEmpresa[]>(sql, valores),
            executor.query<(RowDataPacket & { total: number })[]>(
                `SELECT COUNT(*) AS total
                 FROM registro_pontos p
                 JOIN funcionarios f ON p.funcionario_id = f.id
                 WHERE ${where}`,
                valoresDoTotal
            ),
        ]);
        return { pontos, total };
    },

    // Justificativas do colaborador com data de referência em [de, ate), datas 'AAAA-MM-DD'.
    async justificativasDoColaborador(funcionarioId: number | string, empresaId: number, de: string, ate: string): Promise<JustificativaDoDia[]> {
        const [justificativas] = await executor.query<JustificativaDoDia[]>(
            `SELECT DATE_FORMAT(data_referencia, '%Y-%m-%d') AS dia, texto
             FROM justificativas_ponto
             WHERE funcionario_id = ? AND empresa_id = ? AND data_referencia >= ? AND data_referencia < ?`,
            [funcionarioId, empresaId, de, ate]
        );
        return justificativas;
    },

    // Uma justificativa por colaborador e dia: reenviar substitui o texto.
    async salvarJustificativa({ empresaId, funcionarioId, data, texto }: NovaJustificativa): Promise<void> {
        await executor.query(
            `INSERT INTO justificativas_ponto (empresa_id, funcionario_id, data_referencia, texto)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE texto = VALUES(texto)`,
            [empresaId, funcionarioId, data, texto]
        );
    },

    async instanteDaJustificativa(funcionarioId: number, data: string): Promise<number> {
        const [[salva]] = await executor.query<(RowDataPacket & { instante: number })[]>(
            `SELECT UNIX_TIMESTAMP(atualizado_em) AS instante
             FROM justificativas_ponto WHERE funcionario_id = ? AND data_referencia = ?`,
            [funcionarioId, data]
        );
        return salva.instante;
    },

    // Justificativas da empresa em [de, ate), de todos os colaboradores ou só de `funcionarioId`.
    async justificativasDaEmpresa({ empresaId, de, ate, funcionarioId }: FiltroDeJustificativas): Promise<JustificativaDaEmpresa[]> {
        const filtros = ['j.empresa_id = ?', 'j.data_referencia >= ?', 'j.data_referencia < ?'];
        const valores: Array<number | string> = [empresaId, de, ate];
        if (funcionarioId) {
            filtros.push('j.funcionario_id = ?');
            valores.push(funcionarioId);
        }

        const [linhas] = await executor.query<JustificativaDaEmpresa[]>(
            `SELECT j.id, j.funcionario_id, f.nome AS nome_funcionario,
                    DATE_FORMAT(j.data_referencia, '%Y-%m-%d') AS date, j.texto AS note,
                    UNIX_TIMESTAMP(j.criado_em) AS criado, UNIX_TIMESTAMP(j.atualizado_em) AS atualizado
             FROM justificativas_ponto j
             JOIN funcionarios f ON f.id = j.funcionario_id AND f.empresa_id = j.empresa_id
             WHERE ${filtros.join(' AND ')}
             ORDER BY j.data_referencia DESC, f.nome ASC, j.id ASC`,
            valores
        );
        return linhas;
    },
});

export type RepositorioDoPonto = ReturnType<typeof criarRepositorio>;

// Roda `trabalho` numa conexão em transação: confirma se terminar, desfaz se lançar erro.
// O repositório recebido usa essa conexão.
export const emTransacao = async <T>(trabalho: (repositorio: RepositorioDoPonto) => Promise<T>): Promise<T> => {
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

export const {
    colaboradorExiste,
    ultimoRegistroDoDia,
    inserirRegistro,
    registrosDoPeriodo,
    registrosDaEmpresa,
    justificativasDoColaborador,
    salvarJustificativa,
    instanteDaJustificativa,
    justificativasDaEmpresa,
} = criarRepositorio(db);
