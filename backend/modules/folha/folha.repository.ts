// Todo o SQL da folha. Devolve linhas como o MySQL as entrega e não conhece HTTP nem regra de
// negócio. As consultas rodam no pool ou, dentro de emTransacao, numa conexão reservada.
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../../shared/db/pool.ts';
import type { Rubrica } from './folha.regras.ts';

export type StatusDaFolha = 'aberta' | 'fechada';

export interface Pendencia {
    funcionarioId: number;
    nome: string;
    motivo: string;
}

export interface FolhaGravada extends RowDataPacket {
    id: number;
    competencia: string;
    status: StatusDaFolha;
    razao_social: string | null;
    cnpj: string | null;
    // JSON: o mysql2 já o entrega como objeto.
    pendencias: Pendencia[];
    processada_em: number;
    fechada_em: number | null;
}

// salario_base é DECIMAL: o mysql2 o entrega como texto.
export interface ColaboradorDaFolha extends RowDataPacket {
    id: number;
    nome: string;
    tipo_contrato: string | null;
    salario_base: string | null;
    cargo_nome: string | null;
    departamento_nome: string | null;
}

// Os valores em reais são DECIMAL: texto.
export interface ItemGravado extends RowDataPacket {
    funcionario_id: number;
    nome: string;
    cargo: string | null;
    departamento: string | null;
    tipo_contrato: string | null;
    bruto: string;
    inss: string;
    liquido: string;
    encargos: string;
    rubricas: Rubrica[];
}

export interface HoleritePublicado extends ItemGravado {
    competencia: string;
    razao_social: string | null;
    cnpj: string | null;
}

export interface DadosDaEmpresa extends RowDataPacket {
    razao_social: string | null;
    cnpj: string | null;
}

export interface NovoItem {
    funcionarioId: number;
    nome: string;
    cargo: string | null;
    departamento: string | null;
    tipoContrato: string | null;
    bruto: number;
    inss: number;
    liquido: number;
    encargos: number;
    rubricas: Rubrica[];
}

const COLUNAS_DA_FOLHA = `id, competencia, status, razao_social, cnpj, pendencias,
    UNIX_TIMESTAMP(processada_em) AS processada_em, UNIX_TIMESTAMP(fechada_em) AS fechada_em`;

const COLUNAS_DO_ITEM = 'i.funcionario_id, i.nome, i.cargo, i.departamento, i.tipo_contrato, i.bruto, i.inss, i.liquido, i.encargos, i.rubricas';

const criarRepositorio = (executor: Connection) => ({
    async dadosDaEmpresa(empresaId: number): Promise<DadosDaEmpresa | undefined> {
        const [empresas] = await executor.query<DadosDaEmpresa[]>('SELECT razao_social, cnpj FROM empresas WHERE id = ?', [empresaId]);
        return empresas[0];
    },

    // Quem entra na folha de uma competência: ativos e de férias, mais quem foi desligado no mês dela
    // ou depois (o desligado continua na folha do mês do desligamento e sai a partir da seguinte),
    // desde que já admitido até o último dia dela. Inativo sem data de desligamento fica de fora.
    async colaboradoresDaCompetencia(empresaId: number, primeiroDia: string, ultimoDia: string): Promise<ColaboradorDaFolha[]> {
        const [colaboradores] = await executor.query<ColaboradorDaFolha[]>(
            `SELECT f.id, f.nome, f.tipo_contrato, f.salario_base, c.nome AS cargo_nome, d.nome AS departamento_nome
             FROM funcionarios f
             LEFT JOIN cargos c ON f.cargo_id = c.id
             LEFT JOIN departamentos d ON f.departamento_id = d.id
             WHERE f.empresa_id = ?
               AND (f.status IN ('Ativo', 'Férias') OR (f.status = 'Inativo' AND f.data_desligamento >= ?))
               AND (f.data_admissao IS NULL OR f.data_admissao <= ?)
             ORDER BY f.nome, f.id`,
            [empresaId, primeiroDia, ultimoDia]
        );
        return colaboradores;
    },

    async folhaDaCompetencia(empresaId: number, competencia: string): Promise<FolhaGravada | undefined> {
        const [folhas] = await executor.query<FolhaGravada[]>(
            `SELECT ${COLUNAS_DA_FOLHA} FROM folhas WHERE empresa_id = ? AND competencia = ?`,
            [empresaId, competencia]
        );
        return folhas[0];
    },

    // Bloqueia a linha da folha até o fim da transação: processar e fechar não se atropelam.
    async travarFolha(empresaId: number, competencia: string): Promise<FolhaGravada | undefined> {
        const [folhas] = await executor.query<FolhaGravada[]>(
            `SELECT ${COLUNAS_DA_FOLHA} FROM folhas WHERE empresa_id = ? AND competencia = ? FOR UPDATE`,
            [empresaId, competencia]
        );
        return folhas[0];
    },

    // Cria a folha aberta da competência se ela ainda não existe. Devolve se criou: o MySQL só
    // informa um insertId quando gerou um id novo, e o affectedRows do mysql2 vale 1 nos dois casos.
    async criarFolhaSeNaoExiste(empresaId: number, competencia: string): Promise<boolean> {
        const [resultado] = await executor.query<ResultSetHeader>(
            `INSERT INTO folhas (empresa_id, competencia, pendencias) VALUES (?, ?, '[]')
             ON DUPLICATE KEY UPDATE id = id`,
            [empresaId, competencia]
        );
        return resultado.insertId > 0;
    },

    // Troca todo o conteúdo da folha pelo do novo processamento.
    async gravarProcessamento(folhaId: number, empresaId: number, itens: NovoItem[], pendencias: Pendencia[], empresa: DadosDaEmpresa): Promise<void> {
        await executor.query('DELETE FROM folha_itens WHERE folha_id = ?', [folhaId]);
        if (itens.length > 0) {
            await executor.query(
                `INSERT INTO folha_itens
                 (folha_id, empresa_id, funcionario_id, nome, cargo, departamento, tipo_contrato, bruto, inss, liquido, encargos, rubricas)
                 VALUES ?`,
                [itens.map((item) => [
                    folhaId, empresaId, item.funcionarioId, item.nome, item.cargo, item.departamento, item.tipoContrato,
                    item.bruto, item.inss, item.liquido, item.encargos, JSON.stringify(item.rubricas),
                ])]
            );
        }
        await executor.query(
            'UPDATE folhas SET pendencias = ?, razao_social = ?, cnpj = ?, processada_em = CURRENT_TIMESTAMP WHERE id = ?',
            [JSON.stringify(pendencias), empresa.razao_social, empresa.cnpj, folhaId]
        );
    },

    async fecharFolha(folhaId: number, usuarioId: number, empresa: DadosDaEmpresa): Promise<void> {
        await executor.query(
            `UPDATE folhas SET status = 'fechada', fechada_em = CURRENT_TIMESTAMP, fechada_por = ?, razao_social = ?, cnpj = ?
             WHERE id = ?`,
            [usuarioId, empresa.razao_social, empresa.cnpj, folhaId]
        );
    },

    async itensDaFolha(folhaId: number): Promise<ItemGravado[]> {
        const [itens] = await executor.query<ItemGravado[]>(
            `SELECT ${COLUNAS_DO_ITEM} FROM folha_itens i WHERE i.folha_id = ? ORDER BY i.nome, i.funcionario_id`,
            [folhaId]
        );
        return itens;
    },

    // usuarios.id e funcionarios.id são sequências independentes: a identidade vem do vínculo
    // usuarios.funcionario_id, e só vale dentro da mesma empresa do usuário.
    async funcionarioDoUsuario(usuarioId: number, empresaId: number): Promise<number | undefined> {
        const [vinculos] = await executor.query<(RowDataPacket & { funcionario_id: number })[]>(
            `SELECT f.id AS funcionario_id
             FROM usuarios u
             JOIN funcionarios f ON f.id = u.funcionario_id AND f.empresa_id = u.empresa_id
             WHERE u.id = ? AND u.empresa_id = ?`,
            [usuarioId, empresaId]
        );
        return vinculos[0]?.funcionario_id;
    },

    // Holerites que o colaborador pode ver: só os de folhas fechadas, do mais recente ao mais antigo,
    // ou o de uma competência.
    async holeritesFechados(funcionarioId: number, empresaId: number, competencia: string | null): Promise<HoleritePublicado[]> {
        const [holerites] = await executor.query<HoleritePublicado[]>(
            `SELECT ${COLUNAS_DO_ITEM}, p.competencia, p.razao_social, p.cnpj
             FROM folha_itens i
             JOIN folhas p ON p.id = i.folha_id AND p.empresa_id = i.empresa_id
             WHERE i.funcionario_id = ? AND i.empresa_id = ? AND p.status = 'fechada'${competencia ? ' AND p.competencia = ?' : ''}
             ORDER BY p.competencia DESC`,
            competencia ? [funcionarioId, empresaId, competencia] : [funcionarioId, empresaId]
        );
        return holerites;
    },
});

export type RepositorioDaFolha = ReturnType<typeof criarRepositorio>;

// Roda `trabalho` numa conexão em transação: confirma se terminar, desfaz se lançar erro.
// O repositório recebido usa essa conexão.
export const emTransacao = async <T>(trabalho: (repositorio: RepositorioDaFolha) => Promise<T>): Promise<T> => {
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

export const { folhaDaCompetencia, itensDaFolha, funcionarioDoUsuario, holeritesFechados } = criarRepositorio(db);
