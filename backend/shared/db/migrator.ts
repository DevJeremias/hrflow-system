// Aplica as migrations versionadas de backend/migrations em um banco MySQL.
// Cada arquivo NNNN_nome.sql roda uma vez, em ordem, e fica registrado em schema_migrations
// com o checksum do conteúdo. Uma migration já aplicada nunca é editada: o checksum acusa.
// O MySQL não faz DDL transacional: se uma migration falhar no meio, recrie o banco de desenvolvimento.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';

export interface ConfigDoBanco {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
}

interface Migracao {
    versao: string;
    nome: string;
    sql: string;
    checksum: string;
    auditoria: string | null;
}

interface Violacao extends RowDataPacket {
    violacao: string;
    registro_id: number;
}

const DIRETORIO = path.join(import.meta.dirname, '..', '..', 'migrations');
const NOME_SEGURO = /^[A-Za-z0-9_]+$/;

// O GET_LOCK vale para o servidor inteiro: a trava leva o nome do banco para que bancos diferentes
// (os dos testes em paralelo, por exemplo) migrem ao mesmo tempo e só duas execuções no mesmo banco se esperem.
// O MySQL limita o nome da trava a 64 caracteres; um nome de banco comprido entra como hash.
const travaDoBanco = (banco: string) => {
    const nome = `hrflow_migracoes_${banco}`;
    return nome.length <= 64 ? nome : `hrflow_migracoes_${crypto.createHash('sha256').update(banco).digest('hex').slice(0, 40)}`;
};

export const configDoAmbiente = (env: NodeJS.ProcessEnv = process.env): ConfigDoBanco => ({
    host: env.DB_HOST || 'localhost',
    port: env.DB_PORT ? Number(env.DB_PORT) : undefined,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
});

const validarNomeDoBanco = (config: ConfigDoBanco) => {
    if (!NOME_SEGURO.test(config.database || '')) {
        throw new Error('DB_NAME ausente ou inválido: use apenas letras, números e sublinhado.');
    }
};

export const conectar = (config: ConfigDoBanco, { comBanco = true } = {}) => mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: comBanco ? config.database : undefined,
    multipleStatements: true,
});

const comConexao = async <T>(config: ConfigDoBanco, opcoes: { comBanco?: boolean }, trabalho: (conexao: Connection) => Promise<T>): Promise<T> => {
    const conexao = await conectar(config, opcoes);
    try {
        return await trabalho(conexao);
    } finally {
        await conexao.end();
    }
};

export const criarBanco = async (config: ConfigDoBanco) => {
    validarNomeDoBanco(config);
    await comConexao(config, { comBanco: false }, (conexao) =>
        conexao.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4`));
};

export const removerBanco = async (config: ConfigDoBanco) => {
    validarNomeDoBanco(config);
    await comConexao(config, { comBanco: false }, (conexao) =>
        conexao.query(`DROP DATABASE IF EXISTS \`${config.database}\``));
};

const lerMigracoes = (): Migracao[] => fs.readdirSync(DIRETORIO)
    .filter((arquivo) => /^\d{4}_.+\.sql$/.test(arquivo) && !arquivo.endsWith('.audit.sql'))
    .sort()
    .map((arquivo) => {
        const [, versao, nome] = arquivo.match(/^(\d{4})_(.+)\.sql$/) as RegExpMatchArray;
        const sql = fs.readFileSync(path.join(DIRETORIO, arquivo), 'utf8');
        const caminhoAuditoria = path.join(DIRETORIO, arquivo.replace(/\.sql$/, '.audit.sql'));
        return {
            versao,
            nome,
            sql,
            checksum: crypto.createHash('sha256').update(sql).digest('hex'),
            auditoria: fs.existsSync(caminhoAuditoria) ? fs.readFileSync(caminhoAuditoria, 'utf8') : null,
        };
    });

export class ErroDeAuditoria extends Error {
    violacoes: Violacao[];

    constructor(migracao: Migracao, violacoes: Violacao[]) {
        const porTipo = new Map<string, number[]>();
        for (const { violacao, registro_id } of violacoes) {
            porTipo.set(violacao, [...(porTipo.get(violacao) || []), registro_id]);
        }
        const detalhes = [...porTipo].map(([violacao, ids]) =>
            `  - ${violacao}: ${ids.length} registro(s), ids ${ids.slice(0, 20).join(', ')}${ids.length > 20 ? ', ...' : ''}`);
        super(`A migration ${migracao.versao}_${migracao.nome} não foi aplicada: os dados atuais violariam a nova constraint.\n`
            + `${detalhes.join('\n')}\nCorrija esses registros e rode a migração de novo.`);
        this.name = 'ErroDeAuditoria';
        this.violacoes = violacoes;
    }
}

const auditar = async (conexao: Connection, migracao: Migracao) => {
    const [linhas] = await conexao.query<Violacao[]>(migracao.auditoria as string);
    return linhas;
};

const garantirTabelaDeControle = (conexao: Connection) => conexao.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        versao CHAR(4) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        checksum CHAR(64) NOT NULL,
        aplicada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

const registradas = async (conexao: Connection) => {
    try {
        const [linhas] = await conexao.query<(RowDataPacket & Pick<Migracao, 'versao' | 'nome' | 'checksum'>)[]>(
            'SELECT versao, nome, checksum FROM schema_migrations ORDER BY versao'
        );
        return linhas;
    } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code === 'ER_NO_SUCH_TABLE') return [];
        throw erro;
    }
};

// `ate` limita a última versão aplicada (usado pelos testes para parar antes de uma migration).
export const migrar = async (config: ConfigDoBanco, log: (mensagem: string) => void = () => {}, { ate }: { ate?: string } = {}) => {
    validarNomeDoBanco(config);
    return comConexao(config, {}, async (conexao) => {
        const trava = travaDoBanco(config.database as string);
        const [[{ obtida }]] = await conexao.query<(RowDataPacket & { obtida: number })[]>('SELECT GET_LOCK(?, 30) AS obtida', [trava]);
        if (obtida !== 1) throw new Error('Outra execução de migrations está em andamento neste banco.');
        try {
            await garantirTabelaDeControle(conexao);
            const aplicadas = await registradas(conexao);
            const migracoes = lerMigracoes();

            for (const { versao } of aplicadas) {
                if (!migracoes.some((m) => m.versao === versao)) {
                    throw new Error(`O banco registra a migration ${versao}, que este código não conhece. Atualize o repositório.`);
                }
            }

            const novas: string[] = [];
            for (const migracao of migracoes.filter((m) => !ate || m.versao <= ate)) {
                const existente = aplicadas.find((a) => a.versao === migracao.versao);
                if (existente) {
                    if (existente.checksum !== migracao.checksum) {
                        throw new Error(`A migration ${migracao.versao}_${migracao.nome} foi alterada depois de aplicada. Crie uma migration nova em vez de editar a antiga.`);
                    }
                    continue;
                }
                if (migracao.auditoria) {
                    const violacoes = await auditar(conexao, migracao);
                    if (violacoes.length > 0) throw new ErroDeAuditoria(migracao, violacoes);
                }
                await conexao.query(migracao.sql);
                await conexao.query(
                    'INSERT INTO schema_migrations (versao, nome, checksum) VALUES (?, ?, ?)',
                    [migracao.versao, migracao.nome, migracao.checksum]
                );
                log(`aplicada ${migracao.versao}_${migracao.nome}`);
                novas.push(migracao.versao);
            }
            return novas;
        } finally {
            await conexao.query('SELECT RELEASE_LOCK(?)', [trava]);
        }
    });
};

export const status = async (config: ConfigDoBanco) => {
    validarNomeDoBanco(config);
    return comConexao(config, {}, async (conexao) => {
        const aplicadas = await registradas(conexao);
        return lerMigracoes().map(({ versao, nome, checksum }) => {
            const existente = aplicadas.find((a) => a.versao === versao);
            return { versao, nome, estado: !existente ? 'pendente' : existente.checksum === checksum ? 'aplicada' : 'alterada' };
        });
    });
};

// Roda todas as auditorias contra o banco como está, sem alterar nada: serve para checar
// um banco existente antes de migrá-lo.
export const auditarBanco = async (config: ConfigDoBanco) => {
    validarNomeDoBanco(config);
    return comConexao(config, {}, async (conexao) => {
        const resultados: { migracao: string; violacoes?: Violacao[]; erro?: string }[] = [];
        for (const migracao of lerMigracoes().filter((m) => m.auditoria)) {
            try {
                resultados.push({ migracao: `${migracao.versao}_${migracao.nome}`, violacoes: await auditar(conexao, migracao) });
            } catch (erro) {
                resultados.push({ migracao: `${migracao.versao}_${migracao.nome}`, erro: (erro as Error).message });
            }
        }
        return resultados;
    });
};
