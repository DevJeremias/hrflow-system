// O SQL dos direitos do titular (LGPD): ler tudo o que o sistema guarda de um colaborador, para a
// exportação, e apagar o que o identifica, para a anonimização. Devolve linhas como o MySQL as entrega
// e não conhece HTTP nem regra de negócio. Dentro de emTransacao, usa uma conexão reservada.
import type { Connection, RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';
import { gravarAuditoria } from '../../shared/utils/auditar.ts';
import { criarRepositorio as criarRepositorioDeFuncionarios } from './funcionarios.repository.ts';
import type { RepositorioDeFuncionarios } from './funcionarios.repository.ts';
import type { Autoria, EventoDeAuditoria } from '../../shared/utils/auditar.ts';

// Valor que toma o lugar do que a anonimização apaga em texto de preenchimento obrigatório.
export const TEXTO_REMOVIDO = '[removido na anonimização]';

const criarRepositorio = (executor: Connection) => ({
    async cadastro(funcionarioId: number, empresaId: number): Promise<RowDataPacket | undefined> {
        const [linhas] = await executor.query<RowDataPacket[]>(
            `SELECT f.id, f.nome, f.cpf, f.email, f.telefone, f.data_nascimento, f.data_admissao, f.endereco,
                    f.matricula, f.rg, f.pis, f.ctps, f.cep, f.logradouro, f.numero, f.complemento, f.bairro, f.cidade, f.uf,
                    f.contato_emergencia_nome, f.contato_emergencia_telefone, f.contato_emergencia_parentesco,
                    f.banco, f.agencia, f.conta, f.tipo_conta, f.nivel, f.tipo_contrato, f.salario_base,
                    f.carga_horaria_semanal, f.hora_entrada, f.hora_saida, f.tolerancia_min,
                    f.status, f.data_desligamento, f.motivo_desligamento, f.criado_em,
                    c.nome AS cargo, d.nome AS departamento
             FROM funcionarios f
             LEFT JOIN cargos c ON c.id = f.cargo_id AND c.empresa_id = f.empresa_id
             LEFT JOIN departamentos d ON d.id = f.departamento_id AND d.empresa_id = f.empresa_id
             WHERE f.id = ? AND f.empresa_id = ?`,
            [funcionarioId, empresaId]
        );
        return linhas[0];
    },

    // As contas de acesso do colaborador, sem a senha.
    async contas(funcionarioId: number, empresaId: number): Promise<RowDataPacket[]> {
        const [linhas] = await executor.query<RowDataPacket[]>(
            'SELECT id, nome, email, perfil, criado_em FROM usuarios WHERE funcionario_id = ? AND empresa_id = ?', [funcionarioId, empresaId]
        );
        return linhas;
    },

    async dependentes(funcionarioId: number, empresaId: number): Promise<RowDataPacket[]> {
        const [linhas] = await executor.query<RowDataPacket[]>(
            'SELECT nome, parentesco, data_nascimento, cpf FROM dependentes WHERE funcionario_id = ? AND empresa_id = ? ORDER BY data_nascimento, id', [funcionarioId, empresaId]
        );
        return linhas;
    },

    // Os dependentes são dados de terceiros (nome, nascimento, CPF) ligados ao colaborador: saem com ele.
    async apagarDependentes(funcionarioId: number, empresaId: number): Promise<void> {
        await executor.query('DELETE FROM dependentes WHERE funcionario_id = ? AND empresa_id = ?', [funcionarioId, empresaId]);
    },

    async temAvatar(funcionarioId: number, empresaId: number): Promise<boolean> {
        const [linhas] = await executor.query<RowDataPacket[]>(
            `SELECT 1 FROM avatares a JOIN usuarios u ON u.id = a.usuario_id
             WHERE u.funcionario_id = ? AND u.empresa_id = ? LIMIT 1`, [funcionarioId, empresaId]
        );
        return linhas.length > 0;
    },

    async historicoContratual(funcionarioId: number, empresaId: number): Promise<RowDataPacket[]> {
        const [linhas] = await executor.query<RowDataPacket[]>(
            `SELECT salario_base, cargo, departamento, vigencia_inicio, vigencia_fim
             FROM historico_contratual WHERE funcionario_id = ? AND empresa_id = ? ORDER BY vigencia_inicio, id`, [funcionarioId, empresaId]
        );
        return linhas;
    },

    async marcacoes(funcionarioId: number, empresaId: number): Promise<RowDataPacket[]> {
        const [linhas] = await executor.query<RowDataPacket[]>(
            `SELECT tipo_registro, data_hora_oficial, latitude, longitude, observacao
             FROM registro_pontos WHERE funcionario_id = ? AND empresa_id = ? ORDER BY data_hora_oficial, id`, [funcionarioId, empresaId]
        );
        return linhas;
    },

    async justificativas(funcionarioId: number, empresaId: number): Promise<RowDataPacket[]> {
        const [linhas] = await executor.query<RowDataPacket[]>(
            `SELECT data_referencia, texto, status, resposta, decidido_em, criado_em
             FROM justificativas_ponto WHERE funcionario_id = ? AND empresa_id = ? ORDER BY data_referencia`, [funcionarioId, empresaId]
        );
        return linhas;
    },

    async holerites(funcionarioId: number, empresaId: number): Promise<RowDataPacket[]> {
        const [linhas] = await executor.query<RowDataPacket[]>(
            `SELECT p.competencia, p.status AS situacao_da_folha, i.nome, i.cargo, i.departamento, i.tipo_contrato,
                    i.bruto, i.inss, i.liquido, i.encargos, i.rubricas
             FROM folha_itens i JOIN folhas p ON p.id = i.folha_id AND p.empresa_id = i.empresa_id
             WHERE i.funcionario_id = ? AND i.empresa_id = ? ORDER BY p.competencia`, [funcionarioId, empresaId]
        );
        return linhas;
    },

    async solicitacoes(funcionarioId: number, empresaId: number): Promise<RowDataPacket[]> {
        const [linhas] = await executor.query<RowDataPacket[]>(
            `SELECT alteracoes, anteriores, status, resposta, decidido_em, criado_em
             FROM solicitacoes_alteracao WHERE funcionario_id = ? AND empresa_id = ? ORDER BY id`, [funcionarioId, empresaId]
        );
        return linhas;
    },

    // O que a empresa registrou sobre o colaborador e o que ele mesmo fez no sistema.
    async trilha(funcionarioId: number, empresaId: number): Promise<RowDataPacket[]> {
        const [linhas] = await executor.query<RowDataPacket[]>(
            `SELECT acao, entidade, usuario_nome, perfil, ip, antes, depois, criado_em
             FROM auditoria WHERE funcionario_id = ? AND empresa_id = ? ORDER BY id`, [funcionarioId, empresaId]
        );
        return linhas;
    },

    // --- Anonimização ---

    async anonimizarCadastro(funcionarioId: number, empresaId: number, nome: string, email: string): Promise<void> {
        await executor.query(
            `UPDATE funcionarios
             SET nome = ?, email = ?, cpf = NULL, telefone = NULL, data_nascimento = NULL, endereco = NULL,
                 matricula = NULL, rg = NULL, pis = NULL, ctps = NULL,
                 cep = NULL, logradouro = NULL, numero = NULL, complemento = NULL, bairro = NULL, cidade = NULL, uf = NULL,
                 contato_emergencia_nome = NULL, contato_emergencia_telefone = NULL, contato_emergencia_parentesco = NULL,
                 banco = NULL, agencia = NULL, conta = NULL, tipo_conta = NULL, anonimizado_em = CURRENT_TIMESTAMP
             WHERE id = ? AND empresa_id = ?`,
            [nome, email, funcionarioId, empresaId]
        );
    },

    // O acesso não volta: a senha vira um hash de um valor que ninguém conhece e as sessões caem.
    async anonimizarContas(funcionarioId: number, empresaId: number, nome: string, email: string, senhaCriptografada: string): Promise<number[]> {
        const [contas] = await executor.query<(RowDataPacket & { id: number })[]>(
            'SELECT id FROM usuarios WHERE funcionario_id = ? AND empresa_id = ?', [funcionarioId, empresaId]
        );
        await executor.query(
            `UPDATE usuarios
             SET nome = ?, email = ?, senha = ?, senha_provisoria = FALSE, sessao_versao = sessao_versao + 1
             WHERE funcionario_id = ? AND empresa_id = ?`,
            [nome, email, senhaCriptografada, funcionarioId, empresaId]
        );
        return contas.map((conta) => conta.id);
    },

    async apagarAvatares(usuarioIds: number[]): Promise<void> {
        if (usuarioIds.length > 0) await executor.query('DELETE FROM avatares WHERE usuario_id IN (?)', [usuarioIds]);
    },

    // O holerite fechado guarda os valores, mas o nome na linha identifica a pessoa.
    async anonimizarHolerites(funcionarioId: number, empresaId: number, nome: string): Promise<void> {
        await executor.query('UPDATE folha_itens SET nome = ? WHERE funcionario_id = ? AND empresa_id = ?', [nome, funcionarioId, empresaId]);
    },

    // As marcações ficam, com o id; a localização de onde a pessoa estava deixa de ser guardada.
    async anonimizarMarcacoes(funcionarioId: number, empresaId: number): Promise<void> {
        await executor.query('UPDATE registro_pontos SET latitude = NULL, longitude = NULL WHERE funcionario_id = ? AND empresa_id = ?', [funcionarioId, empresaId]);
    },

    // A decisão fica; o texto livre, que pode contar o motivo (saúde, família), não.
    async anonimizarJustificativas(funcionarioId: number, empresaId: number): Promise<void> {
        await executor.query(
            `UPDATE justificativas_ponto SET texto = ?, resposta = IF(resposta IS NULL, NULL, ?)
             WHERE funcionario_id = ? AND empresa_id = ?`,
            [TEXTO_REMOVIDO, TEXTO_REMOVIDO, funcionarioId, empresaId]
        );
    },

    // O pedido pendente não será mais decidido; os valores pedidos e os anteriores eram os dados pessoais.
    async anonimizarSolicitacoes(funcionarioId: number, empresaId: number): Promise<void> {
        await executor.query(
            `UPDATE solicitacoes_alteracao
             SET status = IF(status = 'pendente', 'cancelada', status), alteracoes = JSON_OBJECT(), anteriores = JSON_OBJECT(), resposta = NULL
             WHERE funcionario_id = ? AND empresa_id = ?`,
            [funcionarioId, empresaId]
        );
    },

    // Quem fez, quando e o quê ficam. O conteúdo de antes e depois, o endereço IP e o nome de quem agiu
    // saem, menos os valores de salário, que são registro da folha e não identificam ninguém sozinhos.
    async anonimizarTrilha(funcionarioId: number, empresaId: number, usuarioIds: number[], nome: string): Promise<void> {
        await executor.query(
            `UPDATE auditoria
             SET antes = IF(acao = 'funcionario.salario_alterado', antes, NULL), depois = IF(acao = 'funcionario.salario_alterado', depois, NULL), ip = NULL
             WHERE funcionario_id = ? AND empresa_id = ?`,
            [funcionarioId, empresaId]
        );
        if (usuarioIds.length > 0) {
            await executor.query('UPDATE auditoria SET usuario_nome = ?, ip = NULL WHERE usuario_id IN (?) AND empresa_id = ?', [nome, usuarioIds, empresaId]);
        }
    },

    auditar(autoria: Autoria, evento: EventoDeAuditoria): Promise<void> {
        return gravarAuditoria(executor, autoria, evento);
    },
});

export type RepositorioDoTitular = ReturnType<typeof criarRepositorio>;

// Roda `trabalho` numa conexão em transação: confirma se terminar, desfaz se lançar erro. Os dois
// repositórios recebidos usam essa conexão: o do titular e o do cadastro (que trava a linha do colaborador).
export const emTransacao = async <T>(trabalho: (repositorio: RepositorioDoTitular, cadastro: RepositorioDeFuncionarios) => Promise<T>): Promise<T> => {
    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        const resultado = await trabalho(criarRepositorio(conexao), criarRepositorioDeFuncionarios(conexao));
        await conexao.commit();
        return resultado;
    } catch (erro) {
        await conexao.rollback().catch(() => {});
        throw erro;
    } finally {
        conexao.release();
    }
};

export const { cadastro: cadastroDoTitular, dependentes, contas, temAvatar, historicoContratual, marcacoes, justificativas, holerites, solicitacoes, trilha } = criarRepositorio(db);
