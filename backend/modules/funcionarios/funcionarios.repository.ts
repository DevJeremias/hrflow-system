// Todo o SQL de funcionários e das credenciais que nascem com eles. Devolve linhas como o MySQL as
// entrega e não conhece HTTP nem regra de negócio. As consultas rodam no pool ou, dentro de
// emTransacao, numa conexão reservada.
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../../config/db.js';
import { cargoDaEmpresa, departamentoDaEmpresa } from '../estrutura/index.ts';
import type { DadosDoFuncionario, Status } from './funcionarios.schemas.ts';

// Linha de funcionarios (SELECT f.*) com os nomes do cargo e do departamento da mesma empresa.
export interface FuncionarioListado extends RowDataPacket {
    id: number;
    nome: string;
    cargo_nome: string | null;
    departamento_nome: string | null;
}

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
    status: Status;
}

const criarRepositorio = (executor: Connection) => ({
    // `limite` e `deslocamento` recortam a página, ordenada por id.
    async listarDaEmpresa(empresaId: number, limite: number, deslocamento: number): Promise<FuncionarioListado[]> {
        const [linhas] = await executor.query<FuncionarioListado[]>(
            `SELECT f.*, c.nome as cargo_nome, d.nome as departamento_nome
             FROM funcionarios f
             LEFT JOIN cargos c ON f.cargo_id = c.id AND c.empresa_id = f.empresa_id
             LEFT JOIN departamentos d ON f.departamento_id = d.id AND d.empresa_id = f.empresa_id
             WHERE f.empresa_id = ?
             ORDER BY f.id
             LIMIT ? OFFSET ?`,
            [empresaId, limite, deslocamento]
        );
        return linhas;
    },

    async contarDaEmpresa(empresaId: number): Promise<number> {
        const [[{ total }]] = await executor.query<(RowDataPacket & { total: number })[]>(
            'SELECT COUNT(*) AS total FROM funcionarios WHERE empresa_id = ?', [empresaId]
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

    async inserirUsuarioColaborador({ nome, email, senhaCriptografada, empresaId, funcionarioId }: NovoUsuario): Promise<void> {
        await executor.query(
            `INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, funcionario_id)
             VALUES (?, ?, ?, 'Colaborador', ?, ?)`,
            [nome, email, senhaCriptografada, empresaId, funcionarioId]
        );
    },

    // Devolve false quando o funcionário não existe na empresa.
    async atualizarFuncionario(f: AtualizacaoDoFuncionario): Promise<boolean> {
        const [resultado] = await executor.query<ResultSetHeader>(
            `UPDATE funcionarios
             SET nome = ?, cpf = ?, email = ?, telefone = ?, data_admissao = ?, data_nascimento = ?,
                 endereco = ?, banco = ?, agencia = ?, conta = ?, tipo_conta = ?, nivel = ?, cargo_id = ?,
                 departamento_id = ?, tipo_contrato = ?, salario_base = ?, status = ?
             WHERE id = ? AND empresa_id = ?`,
            [
                f.nome, f.cpf, f.email, f.telefone, f.data_admissao, f.data_nascimento,
                f.endereco, f.banco, f.agencia, f.conta, f.tipo_conta,
                f.nivel, f.cargo_id, f.departamento_id, f.tipo_contrato, f.salario_base,
                f.status, f.id, f.empresaId,
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
