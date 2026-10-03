// Todo o SQL do ponto. Devolve linhas como o MySQL as entrega (instantes em segundos Unix) e não
// conhece HTTP nem regra de negócio. As consultas rodam no pool ou, dentro de emTransacao, numa
// conexão reservada.
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';
import { gravarAuditoria } from '../../shared/utils/auditar.ts';
import type { Autoria, EventoDeAuditoria } from '../../shared/utils/auditar.ts';
import type { DecisaoDaJustificativa, TipoRegistro } from './ponto.regras.ts';

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

export interface JornadaDoColaborador extends RowDataPacket {
    carga_semanal: string;
    entrada: string;
    saida: string;
    entrada_min: number;
    tolerancia_min: number;
    // 'AAAA-MM-DD', ou null quando a admissão não foi informada.
    admissao: string | null;
}

// Quem a apuração do mês da empresa considera: a jornada de cada colaborador e onde ele trabalha.
export interface ColaboradorParaApurar extends JornadaDoColaborador {
    funcionario_id: number;
    nome: string;
    departamento: string | null;
    // 'AAAA-MM-DD' do desligamento, ou null.
    desligamento: string | null;
}

export interface RegistroDoMes extends RowDataPacket {
    funcionario_id: number;
    tipo_registro: TipoRegistro;
    instante: number;
}

export interface JustificativaDoMes extends JustificativaDoDia {
    funcionario_id: number;
}

export interface JustificativaDoDia extends RowDataPacket {
    dia: string;
    texto: string;
    status: DecisaoDaJustificativa;
    resposta: string | null;
}

export interface JustificativaDaEmpresa extends RowDataPacket {
    id: number;
    funcionario_id: number;
    nome_funcionario: string;
    date: string;
    note: string;
    status: DecisaoDaJustificativa;
    resposta: string | null;
    decidido_por_nome: string | null;
    decidido: number | null;
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
    status: DecisaoDaJustificativa | null;
}

export interface DecisaoRegistrada {
    id: number;
    empresaId: number;
    status: 'aprovada' | 'recusada';
    resposta: string | null;
    decididoPor: number;
}

// Colunas e junções que a lista do RH e a leitura de uma justificativa compartilham.
const SELECT_DA_JUSTIFICATIVA = `SELECT j.id, j.funcionario_id, f.nome AS nome_funcionario,
                    DATE_FORMAT(j.data_referencia, '%Y-%m-%d') AS date, j.texto AS note,
                    j.status, j.resposta, u.nome AS decidido_por_nome,
                    UNIX_TIMESTAMP(j.decidido_em) AS decidido,
                    UNIX_TIMESTAMP(j.criado_em) AS criado, UNIX_TIMESTAMP(j.atualizado_em) AS atualizado
             FROM justificativas_ponto j
             JOIN funcionarios f ON f.id = j.funcionario_id AND f.empresa_id = j.empresa_id
             LEFT JOIN usuarios u ON u.id = j.decidido_por`;

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
            `SELECT DATE_FORMAT(data_referencia, '%Y-%m-%d') AS dia, texto, status, resposta
             FROM justificativas_ponto
             WHERE funcionario_id = ? AND empresa_id = ? AND data_referencia >= ? AND data_referencia < ?`,
            [funcionarioId, empresaId, de, ate]
        );
        return justificativas;
    },

    // Estado atual da justificativa do dia (undefined se não houver), com `travar` até o fim da transação.
    async statusDaJustificativa(funcionarioId: number, data: string, { travar = false } = {}): Promise<DecisaoDaJustificativa | undefined> {
        const [linhas] = await executor.query<(RowDataPacket & { status: DecisaoDaJustificativa })[]>(
            `SELECT status FROM justificativas_ponto WHERE funcionario_id = ? AND data_referencia = ?${travar ? ' FOR UPDATE' : ''}`,
            [funcionarioId, data]
        );
        return linhas[0]?.status;
    },

    // Uma justificativa por colaborador e dia: reenviar substitui o texto e a devolve ao RH como
    // pendente, apagando a decisão anterior (o serviço já recusou o reenvio de uma aprovada).
    async salvarJustificativa({ empresaId, funcionarioId, data, texto }: NovaJustificativa): Promise<void> {
        await executor.query(
            `INSERT INTO justificativas_ponto (empresa_id, funcionario_id, data_referencia, texto)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE texto = VALUES(texto), status = 'pendente', decidido_por = NULL, decidido_em = NULL, resposta = NULL`,
            [empresaId, funcionarioId, data, texto]
        );
    },

    async instanteDaJustificativa(funcionarioId: number, data: string): Promise<{ id: number; instante: number }> {
        const [[salva]] = await executor.query<(RowDataPacket & { id: number; instante: number })[]>(
            `SELECT id, UNIX_TIMESTAMP(atualizado_em) AS instante
             FROM justificativas_ponto WHERE funcionario_id = ? AND data_referencia = ?`,
            [funcionarioId, data]
        );
        return salva;
    },

    auditar(autoria: Autoria, evento: EventoDeAuditoria): Promise<void> {
        return gravarAuditoria(executor, autoria, evento);
    },

    // Justificativas da empresa em [de, ate), de todos os colaboradores ou só de `funcionarioId`, e só
    // do `status` pedido quando houver.
    async justificativasDaEmpresa({ empresaId, de, ate, funcionarioId, status }: FiltroDeJustificativas): Promise<JustificativaDaEmpresa[]> {
        const filtros = ['j.empresa_id = ?', 'j.data_referencia >= ?', 'j.data_referencia < ?'];
        const valores: Array<number | string> = [empresaId, de, ate];
        if (funcionarioId) {
            filtros.push('j.funcionario_id = ?');
            valores.push(funcionarioId);
        }
        if (status) {
            filtros.push('j.status = ?');
            valores.push(status);
        }

        const [linhas] = await executor.query<JustificativaDaEmpresa[]>(
            `${SELECT_DA_JUSTIFICATIVA}
             WHERE ${filtros.join(' AND ')}
             ORDER BY j.data_referencia DESC, f.nome ASC, j.id ASC`,
            valores
        );
        return linhas;
    },

    async justificativaDaEmpresa(id: number, empresaId: number, { travar = false } = {}): Promise<JustificativaDaEmpresa | undefined> {
        const [linhas] = await executor.query<JustificativaDaEmpresa[]>(
            `${SELECT_DA_JUSTIFICATIVA}
             WHERE j.id = ? AND j.empresa_id = ?${travar ? ' FOR UPDATE OF j' : ''}`,
            [id, empresaId]
        );
        return linhas[0];
    },

    async decidirJustificativa({ id, empresaId, status, resposta, decididoPor }: DecisaoRegistrada): Promise<void> {
        await executor.query(
            `UPDATE justificativas_ponto
             SET status = ?, resposta = ?, decidido_por = ?, decidido_em = CURRENT_TIMESTAMP
             WHERE id = ? AND empresa_id = ?`,
            [status, resposta, decididoPor, id, empresaId]
        );
    },

    // Quem entra na apuração do mês: admitido até o último dia e ainda na empresa no primeiro (o
    // desligado sai a partir do dia seguinte ao desligamento; Inativo sem data de desligamento fica fora).
    async colaboradoresParaApurar(empresaId: number, primeiroDia: string, ultimoDia: string): Promise<ColaboradorParaApurar[]> {
        const [linhas] = await executor.query<ColaboradorParaApurar[]>(
            `SELECT f.id AS funcionario_id, f.nome, d.nome AS departamento,
                    f.carga_horaria_semanal AS carga_semanal, TIME_FORMAT(f.hora_entrada, '%H:%i') AS entrada,
                    TIME_FORMAT(f.hora_saida, '%H:%i') AS saida, TIME_TO_SEC(f.hora_entrada) DIV 60 AS entrada_min,
                    f.tolerancia_min, DATE_FORMAT(f.data_admissao, '%Y-%m-%d') AS admissao,
                    DATE_FORMAT(f.data_desligamento, '%Y-%m-%d') AS desligamento
             FROM funcionarios f
             LEFT JOIN departamentos d ON d.id = f.departamento_id AND d.empresa_id = f.empresa_id
             WHERE f.empresa_id = ?
               AND (f.data_admissao IS NULL OR f.data_admissao <= ?)
               AND (f.status <> 'Inativo' OR f.data_desligamento >= ?)
             ORDER BY f.nome, f.id`,
            [empresaId, ultimoDia, primeiroDia]
        );
        return linhas;
    },

    // As marcações de todos os colaboradores da empresa em [inicio, fim), do mais antigo ao mais novo.
    async registrosDoMesDaEmpresa(empresaId: number, inicio: number, fim: number): Promise<RegistroDoMes[]> {
        const [linhas] = await executor.query<RegistroDoMes[]>(
            `SELECT funcionario_id, tipo_registro, UNIX_TIMESTAMP(data_hora_oficial) AS instante
             FROM registro_pontos
             WHERE empresa_id = ? AND data_hora_oficial >= FROM_UNIXTIME(?) AND data_hora_oficial < FROM_UNIXTIME(?)
             ORDER BY data_hora_oficial ASC, id ASC`,
            [empresaId, inicio, fim]
        );
        return linhas;
    },

    // As justificativas de todos os colaboradores da empresa com data de referência em [de, ate).
    async justificativasDoMesDaEmpresa(empresaId: number, de: string, ate: string): Promise<JustificativaDoMes[]> {
        const [linhas] = await executor.query<JustificativaDoMes[]>(
            `SELECT funcionario_id, DATE_FORMAT(data_referencia, '%Y-%m-%d') AS dia, texto, status, resposta
             FROM justificativas_ponto
             WHERE empresa_id = ? AND data_referencia >= ? AND data_referencia < ?`,
            [empresaId, de, ate]
        );
        return linhas;
    },

    async jornadaDoColaborador(funcionarioId: number | string, empresaId: number): Promise<JornadaDoColaborador | undefined> {
        const [linhas] = await executor.query<JornadaDoColaborador[]>(
            `SELECT carga_horaria_semanal AS carga_semanal, TIME_FORMAT(hora_entrada, '%H:%i') AS entrada,
                    TIME_FORMAT(hora_saida, '%H:%i') AS saida, TIME_TO_SEC(hora_entrada) DIV 60 AS entrada_min, tolerancia_min, DATE_FORMAT(data_admissao, '%Y-%m-%d') AS admissao
             FROM funcionarios WHERE id = ? AND empresa_id = ?`,
            [funcionarioId, empresaId]
        );
        return linhas[0];
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
    justificativaDaEmpresa,
    decidirJustificativa,
    statusDaJustificativa,
    jornadaDoColaborador,
    colaboradoresParaApurar,
    registrosDoMesDaEmpresa,
    justificativasDoMesDaEmpresa,
} = criarRepositorio(db);
