// Aplica as migrations versionadas de backend/migrations em um banco MySQL.
// Cada arquivo NNNN_nome.sql roda uma vez, em ordem, e fica registrado em schema_migrations
// com o checksum do conteúdo. Uma migration já aplicada nunca é editada: o checksum acusa.
// O MySQL não faz DDL transacional: se uma migration falhar no meio, recrie o banco de desenvolvimento.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const DIRETORIO = path.join(__dirname, '..', '..', 'migrations');
const NOME_SEGURO = /^[A-Za-z0-9_]+$/;
const TRAVA = 'hrflow_migracoes';

const configDoAmbiente = (env = process.env) => ({
    host: env.DB_HOST || 'localhost',
    port: env.DB_PORT ? Number(env.DB_PORT) : undefined,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
});

const validarNomeDoBanco = (config) => {
    if (!NOME_SEGURO.test(config.database || '')) {
        throw new Error('DB_NAME ausente ou inválido: use apenas letras, números e sublinhado.');
    }
};

const conectar = (config, { comBanco = true } = {}) => mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: comBanco ? config.database : undefined,
    multipleStatements: true,
});

const comConexao = async (config, opcoes, trabalho) => {
    const conexao = await conectar(config, opcoes);
    try {
        return await trabalho(conexao);
    } finally {
        await conexao.end();
    }
};

const criarBanco = async (config) => {
    validarNomeDoBanco(config);
    await comConexao(config, { comBanco: false }, (conexao) =>
        conexao.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4`));
};

const removerBanco = async (config) => {
    validarNomeDoBanco(config);
    await comConexao(config, { comBanco: false }, (conexao) =>
        conexao.query(`DROP DATABASE IF EXISTS \`${config.database}\``));
};

const lerMigracoes = () => fs.readdirSync(DIRETORIO)
    .filter((arquivo) => /^\d{4}_.+\.sql$/.test(arquivo) && !arquivo.endsWith('.audit.sql'))
    .sort()
    .map((arquivo) => {
        const [, versao, nome] = arquivo.match(/^(\d{4})_(.+)\.sql$/);
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

class ErroDeAuditoria extends Error {
    constructor(migracao, violacoes) {
        const porTipo = new Map();
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

const auditar = async (conexao, migracao) => {
    const [linhas] = await conexao.query(migracao.auditoria);
    return linhas;
};

const garantirTabelaDeControle = (conexao) => conexao.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        versao CHAR(4) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        checksum CHAR(64) NOT NULL,
        aplicada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

const registradas = async (conexao) => {
    try {
        const [linhas] = await conexao.query('SELECT versao, nome, checksum FROM schema_migrations ORDER BY versao');
        return linhas;
    } catch (erro) {
        if (erro.code === 'ER_NO_SUCH_TABLE') return [];
        throw erro;
    }
};

// `ate` limita a última versão aplicada (usado pelos testes para parar antes de uma migration).
const migrar = async (config, log = () => {}, { ate } = {}) => {
    validarNomeDoBanco(config);
    return comConexao(config, {}, async (conexao) => {
        const [[{ obtida }]] = await conexao.query('SELECT GET_LOCK(?, 30) AS obtida', [TRAVA]);
        if (obtida !== 1) throw new Error('Outra execução de migrations está em andamento neste servidor.');
        try {
            await garantirTabelaDeControle(conexao);
            const aplicadas = await registradas(conexao);
            const migracoes = lerMigracoes();

            for (const { versao } of aplicadas) {
                if (!migracoes.some((m) => m.versao === versao)) {
                    throw new Error(`O banco registra a migration ${versao}, que este código não conhece. Atualize o repositório.`);
                }
            }

            const novas = [];
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
            await conexao.query('SELECT RELEASE_LOCK(?)', [TRAVA]);
        }
    });
};

const status = async (config) => {
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
const auditarBanco = async (config) => {
    validarNomeDoBanco(config);
    return comConexao(config, {}, async (conexao) => {
        const resultados = [];
        for (const migracao of lerMigracoes().filter((m) => m.auditoria)) {
            try {
                resultados.push({ migracao: `${migracao.versao}_${migracao.nome}`, violacoes: await auditar(conexao, migracao) });
            } catch (erro) {
                resultados.push({ migracao: `${migracao.versao}_${migracao.nome}`, erro: erro.message });
            }
        }
        return resultados;
    });
};

module.exports = {
    configDoAmbiente, criarBanco, removerBanco, migrar, status, auditarBanco, conectar, ErroDeAuditoria,
};
