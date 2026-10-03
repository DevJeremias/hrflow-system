// Banco MySQL descartável para os testes de integração: cada arquivo de teste cria o próprio
// (hrflow_test_<pid>), aplica as migrations de verdade e o apaga ao terminar, sem tocar em DB_NAME.
// Informe o servidor com HRFLOW_TEST_DB_HOST, HRFLOW_TEST_DB_USER, HRFLOW_TEST_DB_PASS e,
// se não for 3306, HRFLOW_TEST_DB_PORT. Sem HRFLOW_TEST_DB_HOST os testes são marcados como
// ignorados, nunca como aprovados.
import crypto from 'node:crypto';
import * as migrator from '../../shared/db/migrator.ts';

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

// Banco novo e migrado até a versão mais recente.
export const preparar = async () => {
    await migrator.removerBanco(config);
    await migrator.criarBanco(config);
    await migrator.migrar(config);
};

export const encerrar = () => migrator.removerBanco(config);

