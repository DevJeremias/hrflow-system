// Banco MySQL descartável para os testes de integração: cada arquivo de teste cria o próprio
// (hrflow_test_<pid>), aplica as migrations de verdade e o apaga ao terminar, sem tocar em DB_NAME.
// Informe o servidor com HRFLOW_TEST_DB_HOST, HRFLOW_TEST_DB_USER, HRFLOW_TEST_DB_PASS e,
// se não for 3306, HRFLOW_TEST_DB_PORT. Sem HRFLOW_TEST_DB_HOST os testes são marcados como
// ignorados, nunca como aprovados.
const crypto = require('node:crypto');
const migrator = require('../../db/migrator');

const host = process.env.HRFLOW_TEST_DB_HOST;
const skip = host ? false : 'HRFLOW_TEST_DB_HOST não definido: sem MySQL, nada foi exercitado.';

const config = {
    host,
    port: process.env.HRFLOW_TEST_DB_PORT ? Number(process.env.HRFLOW_TEST_DB_PORT) : undefined,
    user: process.env.HRFLOW_TEST_DB_USER,
    password: process.env.HRFLOW_TEST_DB_PASS,
    database: `hrflow_test_${process.pid}`,
};

// O pool dos controllers lê estas variáveis ao ser carregado, então elas precisam existir
// antes do primeiro require('../config/db'). O segredo JWT é exigido ao carregar o authMiddleware.
if (host) {
    process.env.DB_HOST = config.host;
    if (config.port) process.env.DB_PORT = String(config.port);
    process.env.DB_USER = config.user;
    process.env.DB_PASS = config.password;
    process.env.DB_NAME = config.database;
}
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// Banco novo e migrado até a versão mais recente.
const preparar = async () => {
    await migrator.removerBanco(config);
    await migrator.criarBanco(config);
    await migrator.migrar(config);
};

const encerrar = () => migrator.removerBanco(config);

module.exports = { skip, config, preparar, encerrar };
