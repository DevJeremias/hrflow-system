// Teste de integração do holerite contra um MySQL de teste descartável.
// Configure DB_HOST, DB_USER, DB_PASS e DB_NAME (o nome deve terminar em "_test",
// pois o teste recria as tabelas). Sem essas variáveis o teste é pulado, não aprovado.
const test = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');

const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = process.env;
const configurado = DB_HOST && DB_USER && DB_NAME;

if (configurado && !DB_NAME.endsWith('_test')) {
    throw new Error('DB_NAME deve terminar em "_test": o teste apaga e recria as tabelas.');
}

const respostaFalsa = () => {
    const res = { statusCode: 200, corpo: undefined };
    res.status = (codigo) => { res.statusCode = codigo; return res; };
    res.json = (corpo) => { res.corpo = corpo; return res; };
    return res;
};

test('meuHolerite resolve a identidade pelo vínculo usuário/funcionário', { skip: !configurado && 'MySQL de teste não configurado (DB_HOST, DB_USER, DB_NAME)' }, async (t) => {
    const conexao = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASS, database: DB_NAME, multipleStatements: true });
    const db = require('../config/db');
    const { meuHolerite } = require('../controllers/folhaController');

    t.after(async () => {
        await conexao.query('SET FOREIGN_KEY_CHECKS = 0; DROP TABLE IF EXISTS usuarios, funcionarios, cargos, departamentos, empresas; SET FOREIGN_KEY_CHECKS = 1;');
        await conexao.end();
        await db.end();
    });

    await conexao.query(`
        SET FOREIGN_KEY_CHECKS = 0;
        DROP TABLE IF EXISTS usuarios, funcionarios, cargos, departamentos, empresas;
        SET FOREIGN_KEY_CHECKS = 1;
        CREATE TABLE empresas (id INT PRIMARY KEY, nome VARCHAR(255) NOT NULL);
        CREATE TABLE cargos (id INT PRIMARY KEY, nome VARCHAR(255) NOT NULL, empresa_id INT NOT NULL);
        CREATE TABLE departamentos (id INT PRIMARY KEY, nome VARCHAR(255) NOT NULL, empresa_id INT NOT NULL);
        CREATE TABLE funcionarios (
            id INT PRIMARY KEY, nome VARCHAR(255) NOT NULL, salario_base DECIMAL(10, 2),
            status ENUM('Ativo', 'Inativo', 'Férias') DEFAULT 'Ativo',
            cargo_id INT, departamento_id INT, empresa_id INT NOT NULL
        );
        CREATE TABLE usuarios (
            id INT PRIMARY KEY, nome VARCHAR(255) NOT NULL, perfil VARCHAR(20) NOT NULL,
            empresa_id INT NOT NULL, funcionario_id INT
        );
    `);

    // Os ids das duas tabelas são deliberadamente diferentes: o usuário 3 está ligado
    // ao funcionário 1, enquanto o funcionário 3 é outra pessoa da mesma empresa.
    await conexao.query(`
        INSERT INTO empresas VALUES (1, 'Empresa Fictícia A'), (2, 'Empresa Fictícia B');
        INSERT INTO cargos VALUES (1, 'Analista Fictício', 1);
        INSERT INTO departamentos VALUES (1, 'Setor Fictício', 1);
        INSERT INTO funcionarios VALUES
            (1, 'Ana Teste', 2000.00, 'Ativo', 1, 1, 1),
            (2, 'Bruno Teste', 2500.00, 'Ativo', 1, 1, 1),
            (3, 'Carla Teste', 4000.00, 'Ativo', 1, 1, 1),
            (4, 'Davi Teste', 3000.00, 'Inativo', 1, 1, 1),
            (5, 'Elisa Teste', 3500.00, 'Ativo', 1, 1, 2);
        INSERT INTO usuarios VALUES
            (1, 'Admin Teste', 'Administrador', 1, NULL),
            (3, 'Ana Usuária', 'Colaborador', 1, 1),
            (99, 'Ana Sem Colisão', 'Colaborador', 1, 1),
            (4, 'Davi Usuário', 'Colaborador', 1, 4),
            (5, 'Elisa Usuária', 'Colaborador', 1, 5);
    `);

    const consultar = async (usuario) => {
        const res = respostaFalsa();
        await meuHolerite({ usuario }, res);
        return res;
    };

    await t.test('entrega o holerite do funcionário vinculado, não o de mesmo id do usuário', async () => {
        const res = await consultar({ id: 3, empresa_id: 1 });
        assert.equal(res.statusCode, 200);
        assert.equal(res.corpo[0].id, '1');
        assert.equal(res.corpo[0].name, 'Ana Teste');
        assert.equal(res.corpo[0].baseSalary, 2000);
    });

    await t.test('não devolve 404 quando nenhum funcionário tem o id do usuário', async () => {
        const res = await consultar({ id: 99, empresa_id: 1 });
        assert.equal(res.statusCode, 200);
        assert.equal(res.corpo[0].name, 'Ana Teste');
    });

    await t.test('ignora o funcionario_id do token e segue o vínculo vigente no banco', async () => {
        const res = await consultar({ id: 3, empresa_id: 1, funcionario_id: 2 });
        assert.equal(res.corpo[0].name, 'Ana Teste');
    });

    await t.test('usuário sem vínculo recebe 404 mesmo havendo funcionário com o mesmo id', async () => {
        const res = await consultar({ id: 1, empresa_id: 1 });
        assert.equal(res.statusCode, 404);
        assert.equal(res.corpo.name, undefined);
    });

    await t.test('funcionário inativo recebe 404', async () => {
        const res = await consultar({ id: 4, empresa_id: 1 });
        assert.equal(res.statusCode, 404);
    });

    await t.test('vínculo com funcionário de outra empresa recebe 404', async () => {
        const res = await consultar({ id: 5, empresa_id: 1 });
        assert.equal(res.statusCode, 404);
    });

    await t.test('empresa do token diferente da empresa do usuário recebe 404', async () => {
        const res = await consultar({ id: 3, empresa_id: 2 });
        assert.equal(res.statusCode, 404);
    });
});
