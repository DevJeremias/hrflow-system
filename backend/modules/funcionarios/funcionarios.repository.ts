// Todo o SQL de funcionários e das credenciais que nascem com eles. Devolve linhas como o MySQL as
// entrega e não conhece HTTP nem regra de negócio. As consultas rodam no pool ou, dentro de
// emTransacao, numa conexão reservada.
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';
import { cargoDaEmpresa, departamentoDaEmpresa } from '../estrutura/index.ts';
import { situacaoEfetivaSql } from '../ausencias/index.ts';
import type { DadosDoFuncionario, FiltrosDeFuncionarios, Situacao, Status } from './funcionarios.schemas.ts';

// Colunas que a tela de colaboradores usa, com os nomes do cargo e do departamento da mesma
// empresa, o perfil do acesso vinculado (null se não há) e se há ponto ou justificativa
// (tem_movimento). Fica de fora o avatar (a listagem não o mostra e ele pesa megabytes).
export interface FuncionarioListado extends RowDataPacket {
    id: number;
    empresa_id: number;
    nome: string;
    email: string;
    cpf: string | null;
    telefone: string | null;
    data_nascimento: string | null;
    data_admissao: string | null;
    endereco: string | null;
    banco: string | null;
    agencia: string | null;
    conta: string | null;
    tipo_conta: string | null;
    nivel: string | null;
    tipo_contrato: string | null;
    salario_base: string | null;
    cargo_id: number | null;
    departamento_id: number | null;
    // A situação de hoje: o status gravado, trocado por Férias ou Afastado enquanto uma ausência aprovada cobre o dia.
    status: Situacao;
    cargo_nome: string | null;
    departamento_nome: string | null;
    data_desligamento: string | null;
    motivo_desligamento: string | null;
    usuario_perfil: string | null;
    tem_movimento: number;
}

// O funcionário e o acesso dele, o que as ações do ciclo de vida precisam saber do alvo.
export interface AlvoDoCicloDeVida extends RowDataPacket {
    id: number;
    nome: string;
    status: Status;
    data_admissao: string | null;
    usuario_id: number | null;
    usuario_perfil: string | null;
}

export interface NovoStatus {
    id: number;
    empresaId: number;
    status: Status;
    dataDoDesligamento: string | null;
    motivoDoDesligamento: string | null;
}

// A busca é um trecho de texto, não um padrão: % e _ valem como eles mesmos.
const escaparLike = (texto: string): string => texto.replace(/[\\%_]/g, '\\$&');

const CAMPOS_DA_BUSCA = ['f.nome', 'f.email', 'f.cpf', 'c.nome', 'd.nome'];

// A empresa vem sempre primeiro; a busca olha nome, e-mail, CPF, cargo e departamento. O filtro de
// status vale para a situação de `hoje` (ver modules/ausencias/ausencias.situacao.ts).
const filtrarDaEmpresa = (empresaId: number, { busca, status, departamento_id: departamentoId }: FiltrosDeFuncionarios, hoje: string) => {
    const condicoes = ['f.empresa_id = ?'];
    const valores: (string | number)[] = [empresaId];
    if (busca) {
        condicoes.push(`(${CAMPOS_DA_BUSCA.map((campo) => `${campo} LIKE ?`).join(' OR ')})`);
        valores.push(...CAMPOS_DA_BUSCA.map(() => `%${escaparLike(busca)}%`));
    }
    if (status) {
        condicoes.push(`${situacaoEfetivaSql('f')} = ?`);
        valores.push(hoje, status);
    }
    if (departamentoId) {
        condicoes.push('f.departamento_id = ?');
        valores.push(departamentoId);
    }
    return { onde: condicoes.join(' AND '), valores };
};

const JUNCOES = `FROM funcionarios f
             LEFT JOIN cargos c ON f.cargo_id = c.id AND c.empresa_id = f.empresa_id
             LEFT JOIN departamentos d ON f.departamento_id = d.id AND d.empresa_id = f.empresa_id`;

export interface NovoFuncionario extends DadosDoFuncionario {
    empresaId: number;
}

export interface NovoUsuario {
    nome: string;
    email: string;
    senhaCriptografada: string;
    empresaId: number;
    funcionarioId: number;
}

export interface AtualizacaoDoFuncionario extends DadosDoFuncionario {
    id: number;
    empresaId: number;
}

const criarRepositorio = (executor: Connection) => ({
    // `limite` e `deslocamento` recortam a página, em ordem alfabética (o desempate por id mantém a
    // paginação estável).
    async listarDaEmpresa(empresaId: number, filtros: FiltrosDeFuncionarios, hoje: string, limite: number, deslocamento: number): Promise<FuncionarioListado[]> {
        const { onde, valores } = filtrarDaEmpresa(empresaId, filtros, hoje);
        const [linhas] = await executor.query<FuncionarioListado[]>(
            // data_desligamento volta como AAAA-MM-DD (a coluna crua chegaria como Date, sujeita a fuso).
            `SELECT f.id, f.empresa_id, f.nome, f.email, f.cpf, f.telefone, f.data_nascimento, f.data_admissao,
                    f.endereco, f.banco, f.agencia, f.conta, f.tipo_conta, f.nivel, f.tipo_contrato,
                    f.salario_base, f.cargo_id, f.departamento_id, ${situacaoEfetivaSql('f')} AS status,
                    DATE_FORMAT(f.data_desligamento, '%Y-%m-%d') AS data_desligamento, f.motivo_desligamento,
                    c.nome AS cargo_nome, d.nome AS departamento_nome,
                    (SELECT u.perfil FROM usuarios u WHERE u.funcionario_id = f.id AND u.empresa_id = f.empresa_id LIMIT 1) AS usuario_perfil,
                    (EXISTS (SELECT 1 FROM registro_pontos r WHERE r.funcionario_id = f.id)
                     OR EXISTS (SELECT 1 FROM justificativas_ponto j WHERE j.funcionario_id = f.id)
                     OR EXISTS (SELECT 1 FROM ausencias x WHERE x.funcionario_id = f.id)) AS tem_movimento
             ${JUNCOES}
             WHERE ${onde}
             ORDER BY f.nome, f.id
             LIMIT ? OFFSET ?`,
            [hoje, ...valores, limite, deslocamento]
        );
        return linhas;
    },

    async contarDaEmpresa(empresaId: number, filtros: FiltrosDeFuncionarios, hoje: string): Promise<number> {
        const { onde, valores } = filtrarDaEmpresa(empresaId, filtros, hoje);
        const [[{ total }]] = await executor.query<(RowDataPacket & { total: number })[]>(
            `SELECT COUNT(*) AS total ${JUNCOES} WHERE ${onde}`, valores
        );
        return total;
    },

    cargoDaEmpresa(cargoId: number, empresaId: number): Promise<boolean> {
        return cargoDaEmpresa(executor, cargoId, empresaId);
    },

    departamentoDaEmpresa(departamentoId: number, empresaId: number): Promise<boolean> {
        return departamentoDaEmpresa(executor, departamentoId, empresaId);
    },

    // O e-mail do login é único em todas as empresas.
    async emailEmUso(email: string): Promise<boolean> {
        const [linhas] = await executor.query<RowDataPacket[]>('SELECT id FROM usuarios WHERE email = ?', [email]);
        return linhas.length > 0;
    },

    // O cadastro novo nasce sempre Ativo.
    async inserirFuncionario(f: NovoFuncionario): Promise<number> {
        const [resultado] = await executor.query<ResultSetHeader>(
            `INSERT INTO funcionarios (
                nome, cpf, email, telefone, data_admissao, data_nascimento,
                endereco, banco, agencia, conta, tipo_conta, nivel, cargo_id,
                departamento_id, tipo_contrato, salario_base, status, empresa_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ativo', ?)`,
            [
                f.nome, f.cpf, f.email, f.telefone, f.data_admissao,
                f.data_nascimento, f.endereco, f.banco, f.agencia,
                f.conta, f.tipo_conta, f.nivel, f.cargo_id, f.departamento_id,
                f.tipo_contrato, f.salario_base, f.empresaId,
            ]
        );
        return resultado.insertId;
    },

    // A senha é definida por quem cadastra: o colaborador a troca no primeiro acesso.
    async inserirUsuarioColaborador({ nome, email, senhaCriptografada, empresaId, funcionarioId }: NovoUsuario): Promise<void> {
        await executor.query(
            `INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, funcionario_id, senha_provisoria)
             VALUES (?, ?, ?, 'Colaborador', ?, ?, TRUE)`,
            [nome, email, senhaCriptografada, empresaId, funcionarioId]
        );
    },

    // Devolve false quando o funcionário não existe na empresa.
    async atualizarFuncionario(f: AtualizacaoDoFuncionario): Promise<boolean> {
        const [resultado] = await executor.query<ResultSetHeader>(
            `UPDATE funcionarios
             SET nome = ?, cpf = ?, email = ?, telefone = ?, data_admissao = ?, data_nascimento = ?,
                 endereco = ?, banco = ?, agencia = ?, conta = ?, tipo_conta = ?, nivel = ?, cargo_id = ?,
                 departamento_id = ?, tipo_contrato = ?, salario_base = ?
             WHERE id = ? AND empresa_id = ?`,
            [
                f.nome, f.cpf, f.email, f.telefone, f.data_admissao, f.data_nascimento,
                f.endereco, f.banco, f.agencia, f.conta, f.tipo_conta,
                f.nivel, f.cargo_id, f.departamento_id, f.tipo_contrato, f.salario_base,
                f.id, f.empresaId,
            ]
        );
        return resultado.affectedRows > 0;
    },

    // Mantém a credencial de acesso igual ao cadastro do funcionário.
    async sincronizarUsuario(funcionarioId: number, empresaId: number, nome: string, email: string): Promise<void> {
        await executor.query(
            'UPDATE usuarios SET email = ?, nome = ? WHERE funcionario_id = ? AND empresa_id = ?',
            [email, nome, funcionarioId, empresaId]
        );
    },

    // Invalida os tokens já emitidos para o funcionário (o authMiddleware confere sessao_versao).
    async derrubarSessoes(funcionarioId: number, empresaId: number): Promise<void> {
        await executor.query(
            'UPDATE usuarios SET sessao_versao = sessao_versao + 1 WHERE funcionario_id = ? AND empresa_id = ?',
            [funcionarioId, empresaId]
        );
    },

    // Trava a linha do funcionário até o fim da transação: marcação nova (que também trava o pai
    // pela chave estrangeira) espera, então a contagem de movimento que se segue não muda.
    async alvoDoCicloDeVida(funcionarioId: number, empresaId: number): Promise<AlvoDoCicloDeVida | undefined> {
        const [linhas] = await executor.query<AlvoDoCicloDeVida[]>(
            `SELECT f.id, f.nome, f.status, DATE_FORMAT(f.data_admissao, '%Y-%m-%d') AS data_admissao,
                    u.id AS usuario_id, u.perfil AS usuario_perfil
             FROM funcionarios f
             LEFT JOIN usuarios u ON u.funcionario_id = f.id AND u.empresa_id = f.empresa_id
             WHERE f.id = ? AND f.empresa_id = ?
             FOR UPDATE`,
            [funcionarioId, empresaId]
        );
        return linhas[0];
    },

    async temMovimento(funcionarioId: number): Promise<boolean> {
        const [[{ total }]] = await executor.query<(RowDataPacket & { total: number })[]>(
            `SELECT (SELECT COUNT(*) FROM registro_pontos WHERE funcionario_id = ?)
                  + (SELECT COUNT(*) FROM justificativas_ponto WHERE funcionario_id = ?)
                  + (SELECT COUNT(*) FROM ausencias WHERE funcionario_id = ?) AS total`,
            [funcionarioId, funcionarioId, funcionarioId]
        );
        return total > 0;
    },

    async atualizarStatus({ id, empresaId, status, dataDoDesligamento, motivoDoDesligamento }: NovoStatus): Promise<void> {
        await executor.query(
            'UPDATE funcionarios SET status = ?, data_desligamento = ?, motivo_desligamento = ? WHERE id = ? AND empresa_id = ?',
            [status, dataDoDesligamento, motivoDoDesligamento, id, empresaId]
        );
    },

    // A senha entregue pelo gestor vale só até a primeira troca; subir a versão da sessão revoga
    // os tokens abertos com a senha anterior.
    async definirSenhaProvisoria(usuarioId: number, senhaCriptografada: string): Promise<void> {
        await executor.query(
            'UPDATE usuarios SET senha = ?, senha_provisoria = TRUE, sessao_versao = sessao_versao + 1 WHERE id = ?',
            [senhaCriptografada, usuarioId]
        );
    },

    async excluirUsuarios(funcionarioId: number, empresaId: number): Promise<void> {
        await executor.query('DELETE FROM usuarios WHERE funcionario_id = ? AND empresa_id = ?', [funcionarioId, empresaId]);
    },

    // Devolve false quando o funcionário não existe na empresa.
    async excluirFuncionario(funcionarioId: number, empresaId: number): Promise<boolean> {
        const [resultado] = await executor.query<ResultSetHeader>(
            'DELETE FROM funcionarios WHERE id = ? AND empresa_id = ?', [funcionarioId, empresaId]
        );
        return resultado.affectedRows > 0;
    },
});

export type RepositorioDeFuncionarios = ReturnType<typeof criarRepositorio>;

// Roda `trabalho` numa conexão em transação: confirma se terminar, desfaz se lançar erro.
// O repositório recebido usa essa conexão.
export const emTransacao = async <T>(trabalho: (repositorio: RepositorioDeFuncionarios) => Promise<T>): Promise<T> => {
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
