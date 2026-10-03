// Departamentos e cargos devolvem os números reais (colaboradores, ocupantes, cargos), a sigla do
// setor em cada cargo, e a exclusão não revela nem toca registros de outra empresa.
//
// Exige um MySQL real (variáveis HRFLOW_TEST_DB_*, ver tests/support/bancoDeTeste.js).
const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const banco = require('./support/bancoDeTeste');
const { criarUsuario, cabecalhosDaSessao } = require('./support/sessao');

describe('estrutura organizacional: contagens e exclusão', { skip: banco.skip }, () => {
    let server, baseUrl, pool;
    let alfa, beta;
    const tokens = {};

    const chamar = async (metodo, caminho, empresaId) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(tokens[empresaId]) },
        });
        return { status: resposta.status, corpo: await resposta.json() };
    };

    before(async () => {
        await banco.preparar();
        pool = require('../config/db');
        const { carregarFixtures } = require('../seeds/fixtures');
        await carregarFixtures(pool, { senha: 'senha-ficticia-123' });

        const express = require('express');
        const authMiddleware = require('../middlewares/authMiddleware');
        const app = express();
        app.use(express.json());
        app.use('/api/estrutura', authMiddleware, require('../routes/estruturaRoutes'));
        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;

        const empresaDe = async (nome) => (await pool.query('SELECT id FROM empresas WHERE nome = ?', [nome]))[0][0].id;
        alfa = await empresaDe('Empresa Ficticia Alfa Ltda');
        beta = await empresaDe('Empresa Ficticia Beta Ltda');
        for (const empresaId of [alfa, beta]) {
            tokens[empresaId] = (await criarUsuario(pool, { empresaId, perfil: 'Administrador' })).token;
        }
    });

    after(async () => {
        if (server) await new Promise((resolve) => server.close(resolve));
        if (pool) await pool.end();
        await banco.encerrar();
    });

    const departamentoDe = async (empresaId, sigla) => {
        const { corpo } = await chamar('GET', '/api/estrutura/departamentos', empresaId);
        return corpo.find((d) => d.sigla === sigla);
    };

    it('conta os colaboradores de cada departamento da empresa', async () => {
        const ti = await departamentoDe(alfa, 'TI');
        assert.equal(ti.total_colaboradores, 1);
        assert.equal(ti.colaboradores_ativos, 1);

        const rh = await departamentoDe(alfa, 'RH');
        assert.equal(rh.total_colaboradores, 1);
        const mkt = await departamentoDe(alfa, 'MKT');
        assert.equal(mkt.total_colaboradores, 0);
        assert.equal(mkt.colaboradores_ativos, 0);
    });

    it('não conta colaborador de outra empresa nem multiplica pelos cargos do departamento', async () => {
        const [[ti]] = await pool.query("SELECT id FROM departamentos WHERE empresa_id = ? AND sigla = 'TI'", [alfa]);
        await pool.query('INSERT INTO cargos (nome, departamento_id, empresa_id) VALUES (?, ?, ?), (?, ?, ?)',
            ['Cargo Extra 1', ti.id, alfa, 'Cargo Extra 2', ti.id, alfa]);

        const depto = await departamentoDe(alfa, 'TI');
        assert.equal(depto.total_colaboradores, 1);
        assert.equal(depto.total_cargos, 3);
        assert.equal((await departamentoDe(beta, 'TI')).total_colaboradores, 1);
    });

    it('separa total de ativos quando há colaborador inativo', async () => {
        const [[ti]] = await pool.query("SELECT id FROM departamentos WHERE empresa_id = ? AND sigla = 'TI'", [alfa]);
        await pool.query(
            "INSERT INTO funcionarios (nome, email, departamento_id, status, empresa_id) VALUES ('Fulano Inativo Ficticio', 'inativo@alfa.exemplo.invalid', ?, 'Inativo', ?)",
            [ti.id, alfa]
        );
        const depto = await departamentoDe(alfa, 'TI');
        assert.equal(depto.total_colaboradores, 2);
        assert.equal(depto.colaboradores_ativos, 1);
    });

    it('lista cada cargo com a sigla do departamento e os ocupantes ativos', async () => {
        const { corpo } = await chamar('GET', '/api/estrutura/cargos', alfa);
        const dev = corpo.find((c) => c.nome === 'Desenvolvedor(a)');
        assert.equal(dev.ocupantes, 1);
        assert.equal(dev.departamento_sigla, 'TI');
        assert.equal(dev.departamento_nome, 'Tecnologia da Informação (TI)');
        assert.equal(corpo.find((c) => c.nome === 'Cargo Extra 1').ocupantes, 0);
        assert.equal(corpo.find((c) => c.nome === 'Assistente Administrativo').departamento_sigla, 'FIN');
    });

    it('não mistura ocupantes de empresas que têm cargos de mesmo nome', async () => {
        const { corpo } = await chamar('GET', '/api/estrutura/cargos', beta);
        const dev = corpo.find((c) => c.nome === 'Desenvolvedor(a)');
        assert.equal(dev.ocupantes, 1);
    });

    it('recusa excluir departamento com cargos e diz o motivo', async () => {
        const ti = await departamentoDe(alfa, 'TI');
        const { status, corpo } = await chamar('DELETE', `/api/estrutura/departamentos/${ti.id}`, alfa);
        assert.equal(status, 400);
        assert.match(corpo.erro, /possui cargos associados/);
    });

    it('responde 404 ao excluir cargo ou departamento de outra empresa, sem revelar dependências', async () => {
        const [[cargoDoBeta]] = await pool.query("SELECT id FROM cargos WHERE empresa_id = ? AND nome = 'Desenvolvedor(a)'", [beta]);
        const deptoDoBeta = await departamentoDe(beta, 'TI');

        const cargo = await chamar('DELETE', `/api/estrutura/cargos/${cargoDoBeta.id}`, alfa);
        assert.equal(cargo.status, 404);
        assert.equal(cargo.corpo.erro, 'Cargo não encontrado.');

        const depto = await chamar('DELETE', `/api/estrutura/departamentos/${deptoDoBeta.id}`, alfa);
        assert.equal(depto.status, 404);
        assert.equal(depto.corpo.erro, 'Departamento não encontrado.');

        const [[{ cargos }]] = await pool.query('SELECT COUNT(*) AS cargos FROM cargos WHERE id = ?', [cargoDoBeta.id]);
        assert.equal(cargos, 1);
    });

    it('exclui departamento vazio e cargo sem ocupantes da própria empresa', async () => {
        const mkt = await departamentoDe(alfa, 'MKT');
        const { corpo: cargos } = await chamar('GET', '/api/estrutura/cargos', alfa);
        for (const cargo of cargos.filter((c) => c.departamento_id === mkt.id)) {
            assert.equal((await chamar('DELETE', `/api/estrutura/cargos/${cargo.id}`, alfa)).status, 200);
        }
        assert.equal((await chamar('DELETE', `/api/estrutura/departamentos/${mkt.id}`, alfa)).status, 200);
        assert.equal(await departamentoDe(alfa, 'MKT'), undefined);
    });
});
