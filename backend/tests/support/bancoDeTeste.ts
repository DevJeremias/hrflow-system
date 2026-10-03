// Banco MySQL descartável para os testes de integração: cada arquivo de teste cria o próprio
// (hrflow_test_<pid>) e o apaga ao terminar, sem tocar em DB_NAME. O banco nasce como cópia do molde
// que o executar.ts (npm test) migrou uma vez por execução; sem o molde (um arquivo rodado direto com o
// node --test), as migrations são aplicadas de verdade no banco do arquivo.
// Informe o servidor com HRFLOW_TEST_DB_HOST, HRFLOW_TEST_DB_USER, HRFLOW_TEST_DB_PASS e,
// se não for 3306, HRFLOW_TEST_DB_PORT. Sem HRFLOW_TEST_DB_HOST os testes são marcados como
// ignorados, nunca como aprovados.
import crypto from 'node:crypto';
import * as migrator from '../../shared/db/migrator.ts';
import type { ConfigDoBanco } from '../../shared/db/migrator.ts';
import type { RowDataPacket } from 'mysql2/promise';

const host = process.env.HRFLOW_TEST_DB_HOST;
export const skip = host ? false : 'HRFLOW_TEST_DB_HOST não definido: sem MySQL, nada foi exercitado.';

export const config = {
    host,
    port: process.env.HRFLOW_TEST_DB_PORT ? Number(process.env.HRFLOW_TEST_DB_PORT) : undefined,
    user: process.env.HRFLOW_TEST_DB_USER,
    password: process.env.HRFLOW_TEST_DB_PASS,
    database: `hrflow_test_${process.pid}`,
};

// O pool dos controllers lê estas variáveis ao ser carregado, então elas precisam existir
// antes de qualquer import do pool (shared/db/pool.ts). O segredo JWT é exigido ao carregar o authMiddleware.
// Por isso este módulo vem sempre primeiro entre os imports dos testes: o ESM avalia os imports em ordem.
if (host) {
    process.env.DB_HOST = config.host;
    if (config.port) process.env.DB_PORT = String(config.port);
    process.env.DB_USER = config.user;
    process.env.DB_PASS = config.password;
    process.env.DB_NAME = config.database;
}
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// Onde o executar.ts guarda o nome do molde, para os arquivos de teste (processos filhos) o acharem.
export const VARIAVEL_DO_MOLDE = 'HRFLOW_TEST_MOLDE';

const identificador = (nome: string) => `\`${nome.replace(/`/g, '``')}\``;

// Copia um banco migrado (esquema, linhas e triggers) para um banco novo, mais barato que reaplicar as
// migrations: o MySQL paga fsync a cada DDL. As tabelas vêm de SHOW CREATE TABLE, que preserva chaves
// estrangeiras e índices; as linhas (schema_migrations) vêm antes dos triggers para não disparar nenhum.
// Views, rotinas e eventos não são copiados: se uma migration os criar, a cópia falha em vez de sair incompleta.
export const clonarBanco = async (origem: ConfigDoBanco, destino: ConfigDoBanco) => {
    await migrator.criarBanco(destino);
    const conexao = await migrator.conectar(destino);
    try {
        const de = origem.database as string;
        const [[{ extras }]] = await conexao.query<(RowDataPacket & { extras: number })[]>(
            `SELECT (SELECT COUNT(*) FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ?)
                  + (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?)
                  + (SELECT COUNT(*) FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ?) AS extras`,
            [de, de, de]
        );
        if (extras > 0) throw new Error('O molde tem views, rotinas ou eventos: clonarBanco só copia tabelas e triggers.');

        const [tabelas] = await conexao.query<RowDataPacket[]>(
            "SELECT TABLE_NAME AS nome FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME", [de]
        );
        await conexao.query('SET FOREIGN_KEY_CHECKS = 0');
        for (const { nome } of tabelas) {
            const [[criacao]] = await conexao.query<RowDataPacket[]>(`SHOW CREATE TABLE ${identificador(de)}.${identificador(nome)}`);
            await conexao.query(criacao['Create Table']);
            await conexao.query(`INSERT INTO ${identificador(nome)} SELECT * FROM ${identificador(de)}.${identificador(nome)}`);
        }
        await conexao.query('SET FOREIGN_KEY_CHECKS = 1');

        const [triggers] = await conexao.query<RowDataPacket[]>('SELECT TRIGGER_NAME AS nome FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?', [de]);
        for (const { nome } of triggers) {
            const [[criacao]] = await conexao.query<RowDataPacket[]>(`SHOW CREATE TRIGGER ${identificador(de)}.${identificador(nome)}`);
            await conexao.query(criacao['SQL Original Statement']);
        }
    } finally {
        await conexao.end();
    }
};

// Banco novo e migrado até a versão mais recente.
export const preparar = async () => {
    await migrator.removerBanco(config);
    const molde = process.env[VARIAVEL_DO_MOLDE];
    if (molde) {
        await clonarBanco({ ...config, database: molde }, config);
    } else {
        await migrator.criarBanco(config);
        await migrator.migrar(config);
    }
};

export const encerrar = () => migrator.removerBanco(config);

