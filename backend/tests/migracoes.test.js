// As migrations contra um MySQL real: aplicação do zero, idempotência, trigger de empresa nova,
// constraints por empresa, auditoria antes da 0003 e fixtures sintéticas.
// Banco e variáveis em tests/support/bancoDeTeste.js; sem HRFLOW_TEST_DB_HOST o teste é pulado.
const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const banco = require('./support/bancoDeTeste');
const migrator = require('../db/migrator');
const { carregarFixtures } = require('../seeds/fixtures');

const TABELAS = ['empresas', 'departamentos', 'cargos', 'funcionarios', 'usuarios', 'registro_pontos', 'schema_migrations'];

describe('migrations', { skip: banco.skip }, () => {
    const principal = banco.config;
    // Banco à parte para os cenários que param antes da 0003 ou adulteram o controle de versão.
    const parcial = { ...principal, database: `${principal.database}_parcial` };
    let conexao;
    let empresaA, empresaB;

    const inserir = async (sql, valores, executor = conexao) => (await executor.query(sql, valores))[0].insertId;
    const codigoDoErro = async (promessa) => {
        try {
            await promessa;
        } catch (erro) {
            return erro.code;
        }
        return null;
    };

    before(async () => {
        await banco.preparar();
        conexao = await migrator.conectar(principal);
        empresaA = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia A']);
        empresaB = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia B']);
    });

    after(async () => {
        if (conexao) await conexao.end();
        await migrator.removerBanco(parcial);
        await banco.encerrar();
    });

    it('cria todas as tabelas em um banco vazio e registra cada migration', async () => {
        const [tabelas] = await conexao.query(
            'SELECT table_name AS nome FROM information_schema.tables WHERE table_schema = ?', [principal.database]
        );
        assert.deepEqual(tabelas.map((t) => t.nome).sort(), [...TABELAS].sort());
        const estados = await migrator.status(principal);
        assert.ok(estados.length >= 3);
        assert.ok(estados.every((m) => m.estado === 'aplicada'));
    });

    it('rodar de novo não aplica nada', async () => {
        assert.deepEqual(await migrator.migrar(principal), []);
    });

    it('recusa uma migration alterada depois de aplicada', async () => {
        await migrator.removerBanco(parcial);
        await migrator.criarBanco(parcial);
        await migrator.migrar(parcial);
        const alvo = await migrator.conectar(parcial);
        try {
            await alvo.query("UPDATE schema_migrations SET checksum = REPEAT('0', 64) WHERE versao = '0001'");
        } finally {
            await alvo.end();
        }
        await assert.rejects(migrator.migrar(parcial), /0001_schema_base foi alterada/);
        assert.equal((await migrator.status(parcial))[0].estado, 'alterada');
    });

    it('o trigger dá departamentos e cargos vinculados a toda empresa nova', async () => {
        for (const empresa of [empresaA, empresaB]) {
            const [departamentos] = await conexao.query('SELECT id FROM departamentos WHERE empresa_id = ?', [empresa]);
            const [cargos] = await conexao.query(
                `SELECT c.id FROM cargos c JOIN departamentos d ON d.id = c.departamento_id AND d.empresa_id = c.empresa_id
                 WHERE c.empresa_id = ?`, [empresa]
            );
            assert.equal(departamentos.length, 4);
            assert.equal(cargos.length, 4);
        }
    });

    describe('constraints por empresa (0003)', () => {
        let departamentoA, departamentoB, cargoA, cargoB;

        before(async () => {
            [[{ id: departamentoA }]] = await conexao.query('SELECT id FROM departamentos WHERE empresa_id = ? LIMIT 1', [empresaA]);
            [[{ id: departamentoB }]] = await conexao.query('SELECT id FROM departamentos WHERE empresa_id = ? LIMIT 1', [empresaB]);
            [[{ id: cargoA }]] = await conexao.query('SELECT id FROM cargos WHERE empresa_id = ? LIMIT 1', [empresaA]);
            [[{ id: cargoB }]] = await conexao.query('SELECT id FROM cargos WHERE empresa_id = ? LIMIT 1', [empresaB]);
        });

        it('recusa cargo com departamento de outra empresa', async () => {
            const erro = await codigoDoErro(conexao.query(
                'INSERT INTO cargos (nome, departamento_id, empresa_id) VALUES (?, ?, ?)', ['Cargo Invasor', departamentoB, empresaA]
            ));
            assert.equal(erro, 'ER_NO_REFERENCED_ROW_2');
        });

        it('recusa funcionário com cargo ou departamento de outra empresa', async () => {
            const comCargo = await codigoDoErro(conexao.query(
                'INSERT INTO funcionarios (nome, email, cargo_id, empresa_id) VALUES (?, ?, ?, ?)',
                ['Pessoa Ficticia', 'pessoa@exemplo.invalid', cargoB, empresaA]
            ));
            const comDepartamento = await codigoDoErro(conexao.query(
                'INSERT INTO funcionarios (nome, email, departamento_id, empresa_id) VALUES (?, ?, ?, ?)',
                ['Pessoa Ficticia', 'pessoa@exemplo.invalid', departamentoB, empresaA]
            ));
            assert.equal(comCargo, 'ER_NO_REFERENCED_ROW_2');
            assert.equal(comDepartamento, 'ER_NO_REFERENCED_ROW_2');
        });

        it('recusa mover um funcionário existente para cargo de outra empresa', async () => {
            const id = await inserir(
                'INSERT INTO funcionarios (nome, email, cargo_id, empresa_id) VALUES (?, ?, ?, ?)',
                ['Pessoa Ficticia', 'pessoa.move@exemplo.invalid', cargoA, empresaA]
            );
            const erro = await codigoDoErro(conexao.query('UPDATE funcionarios SET cargo_id = ? WHERE id = ?', [cargoB, id]));
            assert.equal(erro, 'ER_NO_REFERENCED_ROW_2');
        });

        it('aceita referências da própria empresa e também funcionário sem cargo nem departamento', async () => {
            await inserir(
                'INSERT INTO funcionarios (nome, email, cargo_id, departamento_id, empresa_id) VALUES (?, ?, ?, ?, ?)',
                ['Pessoa Ficticia', 'pessoa.propria@exemplo.invalid', cargoA, departamentoA, empresaA]
            );
            await inserir('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['Pessoa Ficticia', 'pessoa.livre@exemplo.invalid', empresaA]);
            await inserir('INSERT INTO cargos (nome, empresa_id) VALUES (?, ?)', ['Cargo Sem Departamento', empresaA]);
        });
    });

    describe('auditoria antes da 0003', () => {
        let alvo;

        before(async () => {
            await migrator.removerBanco(parcial);
            await migrator.criarBanco(parcial);
            await migrator.migrar(parcial, () => {}, { ate: '0002' });
            alvo = await migrator.conectar(parcial);
        });

        after(async () => {
            if (alvo) await alvo.end();
        });

        it('recusa aplicar a 0003 quando há dado de uma empresa apontando para outra, listando só ids', async () => {
            const a = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia A'], alvo);
            const b = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia B'], alvo);
            const [[{ id: departamentoB }]] = await alvo.query('SELECT id FROM departamentos WHERE empresa_id = ? LIMIT 1', [b]);
            const [[{ id: cargoB }]] = await alvo.query('SELECT id FROM cargos WHERE empresa_id = ? LIMIT 1', [b]);
            const cargoContaminado = await inserir(
                'INSERT INTO cargos (nome, departamento_id, empresa_id) VALUES (?, ?, ?)', ['Cargo Segredo Contaminado', departamentoB, a], alvo
            );
            const funcionarioContaminado = await inserir(
                'INSERT INTO funcionarios (nome, email, cargo_id, departamento_id, empresa_id) VALUES (?, ?, ?, ?, ?)',
                ['Pessoa Segredo Contaminada', 'contaminada@exemplo.invalid', cargoB, departamentoB, a], alvo
            );

            const resultados = await migrator.auditarBanco(parcial);
            const auditoria = resultados.find((r) => r.migracao === '0003_referencias_por_empresa');
            assert.deepEqual(
                auditoria.violacoes.map((v) => [v.violacao.split(' ')[0], v.registro_id]).sort(),
                [['cargos.departamento_id', cargoContaminado], ['funcionarios.cargo_id', funcionarioContaminado], ['funcionarios.departamento_id', funcionarioContaminado]].sort()
            );

            await assert.rejects(migrator.migrar(parcial), (erro) => {
                assert.equal(erro.name, 'ErroDeAuditoria');
                assert.match(erro.message, new RegExp(`ids ${cargoContaminado}\\b`));
                assert.ok(!erro.message.includes('Segredo'), 'a mensagem não deve vazar nomes');
                return true;
            });
            assert.equal((await migrator.status(parcial)).find((m) => m.versao === '0003').estado, 'pendente');

            await alvo.query('DELETE FROM funcionarios WHERE id = ?', [funcionarioContaminado]);
            await alvo.query('DELETE FROM cargos WHERE id = ?', [cargoContaminado]);
            assert.deepEqual(await migrator.migrar(parcial), ['0003']);
        });
    });

    describe('fixtures sintéticas', () => {
        it('carrega duas empresas, e não repete na segunda vez', async () => {
            await migrator.removerBanco(parcial);
            await migrator.criarBanco(parcial);
            await migrator.migrar(parcial);
            const alvo = await migrator.conectar(parcial);
            try {
                assert.equal(await carregarFixtures(alvo, { senha: 'senha-ficticia' }), true);
                assert.equal(await carregarFixtures(alvo, { senha: 'senha-ficticia' }), false);

                const [empresas] = await alvo.query('SELECT id FROM empresas');
                assert.equal(empresas.length, 2);
                const [usuarios] = await alvo.query('SELECT id, funcionario_id, empresa_id, senha, perfil FROM usuarios');
                const vinculados = usuarios.filter((u) => u.funcionario_id !== null);
                assert.ok(vinculados.length >= 4);
                assert.ok(vinculados.every((u) => u.id !== u.funcionario_id), 'usuario.id nunca coincide com o funcionario.id vinculado');
                assert.deepEqual([...new Set(usuarios.map((u) => u.perfil))].sort(), ['Administrador', 'Colaborador', 'RH']);
                assert.equal(await bcrypt.compare('senha-ficticia', usuarios[0].senha), true);

                const [pontos] = await alvo.query('SELECT DISTINCT empresa_id FROM registro_pontos');
                assert.equal(pontos.length, 2);
            } finally {
                await alvo.end();
            }
        });
    });
});
