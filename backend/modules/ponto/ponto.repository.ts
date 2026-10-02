// Todo o SQL do ponto. Devolve linhas como o MySQL as entrega (instantes em segundos Unix) e não
// conhece HTTP nem regra de negócio. As consultas rodam no pool ou, dentro de emTransacao, numa
// conexão reservada.
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../../config/db.js';
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

    async registrosDaEmpresa(empresaId: number): Promise<RegistroDaEmpresa[]> {
        const [pontos] = await executor.query<RegistroDaEmpresa[]>(
            `SELECT p.id, p.funcionario_id, p.empresa_id, p.tipo_registro, p.latitude, p.longitude, p.observacao,
                    UNIX_TIMESTAMP(p.data_hora_oficial) AS instante, f.nome as nome_funcionario
             FROM registro_pontos p
             JOIN funcionarios f ON p.funcionario_id = f.id
             WHERE p.empresa_id = ?
             ORDER BY p.data_hora_oficial DESC`,
            [empresaId]
        );
        return pontos;
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
