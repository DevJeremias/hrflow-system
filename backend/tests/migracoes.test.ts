// As migrations contra um MySQL real: aplicação do zero, idempotência, trigger de empresa nova,
// constraints por empresa, auditoria antes da 0003 e fixtures sintéticas.
// Banco e variáveis em tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST o teste é pulado.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import * as banco from './support/bancoDeTeste.ts';
import * as migrator from '../shared/db/migrator.ts';
import { carregarFixtures } from '../shared/db/fixtures.ts';
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

const TABELAS = ['empresas', 'departamentos', 'cargos', 'funcionarios', 'dependentes', 'usuarios', 'registro_pontos', 'justificativas_ponto', 'folhas', 'folha_itens', 'schema_migrations'];

describe('migrations', { skip: banco.skip }, () => {
    const principal = banco.config;
    // Banco à parte para os cenários que param antes da 0003 ou adulteram o controle de versão.
    const parcial = { ...principal, database: `${principal.database}_parcial` };
    let conexao: Connection;
    let empresaA: number, empresaB: number;

    const inserir = async (sql: string, valores: unknown[], executor = conexao) => (await executor.query<ResultSetHeader>(sql, valores))[0].insertId;
    const codigoDoErro = async (promessa: Promise<unknown>) => {
        try {
            await promessa;
        } catch (erro) {
            return (erro as { code?: string }).code;
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
        const [tabelas] = await conexao.query<RowDataPacket[]>(
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

    it('o banco do arquivo, copiado do molde, é idêntico a um migrado do zero', async () => {
        await migrator.removerBanco(parcial);
        await migrator.criarBanco(parcial);
        await migrator.migrar(parcial);
        const alvo = await migrator.conectar(parcial);
        try {
            const descrever = async (executor: Connection, banco: string) => {
                const [tabelas] = await executor.query<RowDataPacket[]>(
                    "SELECT TABLE_NAME AS nome FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME", [banco]
                );
                const esquema: Record<string, string> = {};
                for (const { nome } of tabelas) {
                    const [[criacao]] = await executor.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${banco}\`.\`${nome}\``);
                    esquema[nome] = criacao['Create Table'].replace(/ AUTO_INCREMENT=\d+/, '');
                }
                const [triggers] = await executor.query<RowDataPacket[]>(
                    'SELECT TRIGGER_NAME AS nome, ACTION_TIMING AS momento, EVENT_MANIPULATION AS evento, EVENT_OBJECT_TABLE AS tabela, ACTION_STATEMENT AS corpo FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ? ORDER BY TRIGGER_NAME', [banco]
                );
                const [migracoes] = await executor.query<RowDataPacket[]>(`SELECT versao, nome, checksum FROM \`${banco}\`.schema_migrations ORDER BY versao`);
                return { esquema, triggers, migracoes };
            };
            assert.deepEqual(await descrever(conexao, principal.database), await descrever(alvo, parcial.database));
        } finally {
            await alvo.end();
        }
    });

    it('a trava de migração é por banco: a migração de um banco não espera a de outro', async () => {
        await migrator.removerBanco(parcial);
        await migrator.criarBanco(parcial);
        const segurando = await migrator.conectar(principal, { comBanco: false });
        try {
            await segurando.query('SELECT GET_LOCK(?, 5)', [`hrflow_migracoes_${parcial.database}`]);
            const emAndamento = migrator.migrar(parcial);
            const inicio = Date.now();
            assert.deepEqual(await migrator.migrar(principal), []);
            assert.ok(Date.now() - inicio < 5000, 'migrar o banco principal esperou a trava do banco parcial');
            await segurando.query('SELECT RELEASE_LOCK(?)', [`hrflow_migracoes_${parcial.database}`]);
            assert.ok((await emAndamento).length >= 3);
        } finally {
            await segurando.end();
        }
    });

    it('audita vínculos usuário/funcionário legados antes de aplicar a 0007', async () => {
        await migrator.removerBanco(parcial);
        await migrator.criarBanco(parcial);
        await migrator.migrar(parcial, () => {}, { ate: '0006' });
        const alvo = await migrator.conectar(parcial);
        let usuario: number | undefined;
        try {
            const empresaLocal = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Local Ficticia'], alvo);
            const empresaExterna = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Externa Ficticia'], alvo);
            const funcionario = await inserir(
                'INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['Funcionário Externo Fictício', 'auditoria.funcionario@exemplo.invalid', empresaExterna], alvo
            );
            await alvo.query('SET FOREIGN_KEY_CHECKS = 0');
            usuario = await inserir(
                'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, funcionario_id) VALUES (?, ?, ?, ?, ?, ?)',
                ['Usuário Fictício', 'auditoria.vinculo@exemplo.invalid', 'hash-ficticio', 'Colaborador', empresaLocal, funcionario], alvo
            );
            await alvo.query('SET FOREIGN_KEY_CHECKS = 1');

            const resultados = await migrator.auditarBanco(parcial);
            const auditoria = resultados.find((r) => r.migracao === '0007_vinculo_usuario_funcionario_empresa');
            assert.ok(auditoria?.violacoes);
            assert.deepEqual(auditoria.violacoes.map(({ violacao, registro_id }) => [violacao, registro_id]), [
                ['usuarios.funcionario_id pertence a outra empresa', usuario],
            ]);
            await assert.rejects(migrator.migrar(parcial), (erro: Error) => erro.name === 'ErroDeAuditoria');
        } finally {
            await alvo.query('SET FOREIGN_KEY_CHECKS = 1');
            if (usuario) await alvo.query('DELETE FROM usuarios WHERE id = ?', [usuario]);
            await alvo.end();
        }
        assert.deepEqual(await migrator.migrar(parcial, () => {}, { ate: '0007' }), ['0007']);
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
            const [departamentos] = await conexao.query<RowDataPacket[]>('SELECT id FROM departamentos WHERE empresa_id = ?', [empresa]);
            const [cargos] = await conexao.query<RowDataPacket[]>(
                `SELECT c.id FROM cargos c JOIN departamentos d ON d.id = c.departamento_id AND d.empresa_id = c.empresa_id
                 WHERE c.empresa_id = ?`, [empresa]
            );
            assert.equal(departamentos.length, 4);
            assert.equal(cargos.length, 4);
        }
    });

    describe('constraints por empresa (0003)', () => {
        let departamentoA: number, departamentoB: number, cargoA: number, cargoB: number;

        before(async () => {
            [[{ id: departamentoA }]] = await conexao.query<RowDataPacket[]>('SELECT id FROM departamentos WHERE empresa_id = ? LIMIT 1', [empresaA]);
            [[{ id: departamentoB }]] = await conexao.query<RowDataPacket[]>('SELECT id FROM departamentos WHERE empresa_id = ? LIMIT 1', [empresaB]);
            [[{ id: cargoA }]] = await conexao.query<RowDataPacket[]>('SELECT id FROM cargos WHERE empresa_id = ? LIMIT 1', [empresaA]);
            [[{ id: cargoB }]] = await conexao.query<RowDataPacket[]>('SELECT id FROM cargos WHERE empresa_id = ? LIMIT 1', [empresaB]);
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
        let alvo: Connection;

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
            const [[{ id: departamentoB }]] = await alvo.query<RowDataPacket[]>('SELECT id FROM departamentos WHERE empresa_id = ? LIMIT 1', [b]);
            const [[{ id: cargoB }]] = await alvo.query<RowDataPacket[]>('SELECT id FROM cargos WHERE empresa_id = ? LIMIT 1', [b]);
            const cargoContaminado = await inserir(
                'INSERT INTO cargos (nome, departamento_id, empresa_id) VALUES (?, ?, ?)', ['Cargo Segredo Contaminado', departamentoB, a], alvo
            );
            const funcionarioContaminado = await inserir(
                'INSERT INTO funcionarios (nome, email, cargo_id, departamento_id, empresa_id) VALUES (?, ?, ?, ?, ?)',
                ['Pessoa Segredo Contaminada', 'contaminada@exemplo.invalid', cargoB, departamentoB, a], alvo
            );

            const resultados = await migrator.auditarBanco(parcial);
            const auditoria = resultados.find((r) => r.migracao === '0003_referencias_por_empresa');
            assert.ok(auditoria?.violacoes);
            assert.deepEqual(
                auditoria.violacoes.map((v) => [v.violacao.split(' ')[0], v.registro_id]).sort(),
                [['cargos.departamento_id', cargoContaminado], ['funcionarios.cargo_id', funcionarioContaminado], ['funcionarios.departamento_id', funcionarioContaminado]].sort()
            );

            await assert.rejects(migrator.migrar(parcial), (erro: Error) => {
                assert.equal(erro.name, 'ErroDeAuditoria');
                assert.match(erro.message, new RegExp(`ids ${cargoContaminado}\\b`));
                assert.ok(!erro.message.includes('Segredo'), 'a mensagem não deve vazar nomes');
                return true;
            });
            assert.equal((await migrator.status(parcial)).find((m) => m.versao === '0003')?.estado, 'pendente');

            await alvo.query('DELETE FROM funcionarios WHERE id = ?', [funcionarioContaminado]);
            await alvo.query('DELETE FROM cargos WHERE id = ?', [cargoContaminado]);
            assert.deepEqual(await migrator.migrar(parcial, () => {}, { ate: '0004' }), ['0003', '0004']);
        });
    });

    describe('coordenadas do ponto (0005)', () => {
        let alvo: Connection;
        let empresa: number, funcionario: number;
        const marcar = (latitude: number | null, longitude: number | null, executor = alvo) => executor.query<ResultSetHeader>(
            "INSERT INTO registro_pontos (funcionario_id, empresa_id, tipo_registro, latitude, longitude) VALUES (?, ?, 'Entrada', ?, ?)",
            [funcionario, empresa, latitude, longitude]
        );

        before(async () => {
            await migrator.removerBanco(parcial);
            await migrator.criarBanco(parcial);
            await migrator.migrar(parcial, () => {}, { ate: '0004' });
            alvo = await migrator.conectar(parcial);
            empresa = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia A'], alvo);
            funcionario = await inserir('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['Pessoa Ficticia', 'ponto@exemplo.invalid', empresa], alvo);
        });

        after(async () => {
            if (alvo) await alvo.end();
        });

        it('a auditoria lista só ids de marcações com coordenadas impossíveis ou incompletas e a 0005 recusa aplicar', async () => {
            const [[semLongitude], [latitudeAlta], [longitudeBaixa], [valida], [semNada]] = await Promise.all([
                marcar(-1.45, null), marcar(91, 0), marcar(0, -181), marcar(-1.45, -48.5), marcar(null, null),
            ]);
            const ids = (r: ResultSetHeader) => r.insertId;

            const auditoria = (await migrator.auditarBanco(parcial)).find((r) => r.migracao === '0005_ponto_coordenadas');

            assert.ok(auditoria?.violacoes);
            assert.deepEqual(
                auditoria.violacoes.map((v) => v.registro_id).sort((a, b) => a - b),
                [ids(semLongitude), ids(latitudeAlta), ids(longitudeBaixa)].sort((a, b) => a - b)
            );
            assert.ok(!auditoria.violacoes.some((v) => [ids(valida), ids(semNada)].includes(v.registro_id)));

            await assert.rejects(migrator.migrar(parcial), (erro: Error) => erro.name === 'ErroDeAuditoria' && /0005_ponto_coordenadas/.test(erro.message));
            assert.equal((await migrator.status(parcial)).find((m) => m.versao === '0005')?.estado, 'pendente');

            await alvo.query('DELETE FROM registro_pontos WHERE id IN (?)', [[ids(semLongitude), ids(latitudeAlta), ids(longitudeBaixa)]]);
            assert.deepEqual(await migrator.migrar(parcial, () => {}, { ate: '0005' }), ['0005']);
        });

        it('depois da 0005 o banco recusa coordenadas fora do intervalo e pares incompletos', async () => {
            for (const [latitude, longitude] of [[90.5, 0], [-90.5, 0], [0, 180.5], [0, -180.5], [1, null], [null, 1]]) {
                assert.equal(await codigoDoErro(marcar(latitude, longitude)), 'ER_CHECK_CONSTRAINT_VIOLATED', `${latitude},${longitude}`);
            }
        });

        it('depois da 0005 o banco aceita extremos, zero e marcação sem coordenadas', async () => {
            for (const [latitude, longitude] of [[90, 180], [-90, -180], [0, 0], [null, null], [-1.45502, -48.5024]]) {
                await marcar(latitude, longitude);
            }
        });

        it('cria o índice por colaborador e instante', async () => {
            const [indices] = await alvo.query<RowDataPacket[]>(
                "SELECT column_name AS coluna FROM information_schema.statistics WHERE table_schema = ? AND index_name = 'idx_registro_pontos_funcionario_data' ORDER BY seq_in_index",
                [parcial.database]
            );
            assert.deepEqual(indices.map((i) => i.coluna), ['funcionario_id', 'data_hora_oficial']);
        });
    });

    describe('cadastro completo (0016)', () => {
        let alvo: Connection;
        let empresa: number, outraEmpresa: number;
        const colaborador = (nome: string, cpf: string | null, empresaId: number) =>
            inserir('INSERT INTO funcionarios (nome, email, cpf, empresa_id) VALUES (?, ?, ?, ?)', [nome, `${nome}@exemplo.invalid`.replace(/\s/g, ''), cpf, empresaId], alvo);

        before(async () => {
            await migrator.removerBanco(parcial);
            await migrator.criarBanco(parcial);
            await migrator.migrar(parcial, () => {}, { ate: '0015' });
            alvo = await migrator.conectar(parcial);
            empresa = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia A'], alvo);
            outraEmpresa = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia B'], alvo);
        });

        after(async () => {
            if (alvo) await alvo.end();
        });

        it('a auditoria lista só ids de CPF repetido na empresa, CPF sem 11 dígitos e nomes repetidos, e a 0016 recusa aplicar', async () => {
            const pontuado = await colaborador('Pontuado', '529.982.247-25', empresa);
            const soDigitos = await colaborador('Digitos', '52998224725', empresa);
            const naOutraEmpresa = await colaborador('Outra', '529.982.247-25', outraEmpresa);
            const curto = await colaborador('Curto', '123', empresa);
            const vazioUm = await colaborador('Vazio um', '', empresa);
            const vazioDois = await colaborador('Vazio dois', '', empresa);
            const [[{ id: departamento }]] = await alvo.query<RowDataPacket[]>('SELECT id FROM departamentos WHERE empresa_id = ? AND sigla = ?', [empresa, 'TI']);
            const departamentoRepetido = await inserir('INSERT INTO departamentos (nome, sigla, empresa_id) VALUES (?, ?, ?)', [' tecnologia da informação (ti) ', 'TI2', empresa], alvo);
            const [[{ id: cargoExistente }]] = await alvo.query<RowDataPacket[]>('SELECT id FROM cargos WHERE departamento_id = ?', [departamento]);
            const cargoRepetido = await inserir('INSERT INTO cargos (nome, departamento_id, empresa_id) VALUES (?, ?, ?)', ['DESENVOLVEDOR(A)', departamento, empresa], alvo);

            const auditoria = (await migrator.auditarBanco(parcial)).find((r) => r.migracao === '0016_cadastro_completo');
            assert.ok(auditoria?.violacoes);
            const porTipo = (tipo: string) => auditoria.violacoes?.filter((v) => v.violacao.startsWith(tipo)).map((v) => v.registro_id).sort((a, b) => a - b);
            assert.deepEqual(porTipo('funcionarios.cpf repetido'), [pontuado, soDigitos].sort((a, b) => a - b));
            assert.deepEqual(porTipo('funcionarios.cpf não tem'), [curto]);
            assert.equal(porTipo('departamentos.nome')?.length, 2);
            assert.ok(porTipo('departamentos.nome')?.includes(departamentoRepetido));
            assert.deepEqual(porTipo('cargos.nome'), [cargoExistente, cargoRepetido].sort((a, b) => a - b));
            const ids = auditoria.violacoes.map((v) => v.registro_id);
            assert.ok(![naOutraEmpresa, vazioUm, vazioDois].some((id) => ids.includes(id)), 'CPF em outra empresa e CPF vazio não são violações');

            await assert.rejects(migrator.migrar(parcial), (erro: Error) => erro.name === 'ErroDeAuditoria' && /0016_cadastro_completo/.test(erro.message));
            assert.equal((await migrator.status(parcial)).find((m) => m.versao === '0016')?.estado, 'pendente');

            await alvo.query('DELETE FROM funcionarios WHERE id IN (?)', [[soDigitos, curto]]);
            await alvo.query('DELETE FROM cargos WHERE id = ?', [cargoRepetido]);
            await alvo.query('DELETE FROM departamentos WHERE id = ?', [departamentoRepetido]);
            assert.deepEqual(await migrator.migrar(parcial, () => {}, { ate: '0016' }), ['0016']);
        });

        it('a migração guarda o CPF só com dígitos e esvazia o que era vazio', async () => {
            const [linhas] = await alvo.query<RowDataPacket[]>('SELECT nome, cpf FROM funcionarios ORDER BY id');
            assert.deepEqual(linhas.map((l) => [l.nome, l.cpf]), [
                ['Pontuado', '52998224725'], ['Outra', '52998224725'], ['Vazio um', null], ['Vazio dois', null],
            ]);
        });

        it('o banco recusa CPF e matrícula repetidos na empresa e aceita em outra', async () => {
            assert.equal(await codigoDoErro(colaborador('Copia', '52998224725', empresa)), 'ER_DUP_ENTRY');
            await colaborador('Sem cpf um', null, empresa);
            await colaborador('Sem cpf dois', null, empresa);
            await inserir('INSERT INTO funcionarios (nome, email, matricula, empresa_id) VALUES (?, ?, ?, ?)', ['Matricula um', 'm1@exemplo.invalid', 'M-1', empresa], alvo);
            assert.equal(await codigoDoErro(inserir('INSERT INTO funcionarios (nome, email, matricula, empresa_id) VALUES (?, ?, ?, ?)', ['Matricula dois', 'm2@exemplo.invalid', 'M-1', empresa], alvo)), 'ER_DUP_ENTRY');
            await inserir('INSERT INTO funcionarios (nome, email, matricula, empresa_id) VALUES (?, ?, ?, ?)', ['Matricula tres', 'm3@exemplo.invalid', 'M-1', outraEmpresa], alvo);
        });

        it('o banco recusa departamento e cargo de nome repetido, sem distinguir caixa', async () => {
            assert.equal(await codigoDoErro(inserir('INSERT INTO departamentos (nome, sigla, empresa_id) VALUES (?, ?, ?)', ['FINANCEIRO', 'F2', empresa], alvo)), 'ER_DUP_ENTRY');
            await inserir('INSERT INTO departamentos (nome, sigla, empresa_id) VALUES (?, ?, ?)', ['Financeiro Extra', 'FE', empresa], alvo);
            const [[{ id: departamento }]] = await alvo.query<RowDataPacket[]>('SELECT id FROM departamentos WHERE empresa_id = ? AND sigla = ?', [empresa, 'FIN']);
            assert.equal(await codigoDoErro(inserir('INSERT INTO cargos (nome, departamento_id, empresa_id) VALUES (?, ?, ?)', ['assistente administrativo', departamento, empresa], alvo)), 'ER_DUP_ENTRY');
            const [[{ id: outroDepartamento }]] = await alvo.query<RowDataPacket[]>('SELECT id FROM departamentos WHERE empresa_id = ? AND sigla = ?', [empresa, 'MKT']);
            await inserir('INSERT INTO cargos (nome, departamento_id, empresa_id) VALUES (?, ?, ?)', ['Assistente Administrativo', outroDepartamento, empresa], alvo);
        });

        it('dependente não aponta para colaborador de outra empresa e some junto com o cadastro', async () => {
            const dono = await colaborador('Com dependente', null, empresa);
            const novo = (funcionarioId: number, empresaId: number, cpf: string | null = null) => inserir(
                "INSERT INTO dependentes (funcionario_id, empresa_id, nome, parentesco, data_nascimento, cpf) VALUES (?, ?, 'Filha Ficticia', 'Filho(a)', '2018-05-01', ?)",
                [funcionarioId, empresaId, cpf], alvo
            );
            assert.equal(await codigoDoErro(novo(dono, outraEmpresa)), 'ER_NO_REFERENCED_ROW_2');
            assert.equal(await codigoDoErro(novo(dono, empresa, '123')), 'ER_CHECK_CONSTRAINT_VIOLATED');
            await novo(dono, empresa, '11144477735');
            assert.equal(await codigoDoErro(novo(dono, empresa, '11144477735')), 'ER_DUP_ENTRY');
            await alvo.query('DELETE FROM funcionarios WHERE id = ?', [dono]);
            const [restantes] = await alvo.query<RowDataPacket[]>('SELECT id FROM dependentes WHERE funcionario_id = ?', [dono]);
            assert.equal(restantes.length, 0);
        });
    });

    describe('fixtures sintéticas', () => {
        it('recusa uma carga parcial sem declarar sucesso nem alterar o estado', async () => {
            await migrator.removerBanco(parcial);
            await migrator.criarBanco(parcial);
            await migrator.migrar(parcial);
            const alvo = await migrator.conectar(parcial);
            try {
                await alvo.query('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia Alfa Ltda']);
                await assert.rejects(
                    carregarFixtures(alvo, { senha: 'senha-ficticia' }),
                    /Carga parcial de fixtures detectada/
                );
                const [empresas] = await alvo.query<RowDataPacket[]>('SELECT id FROM empresas');
                const [usuarios] = await alvo.query<RowDataPacket[]>('SELECT id FROM usuarios');
                assert.equal(empresas.length, 1);
                assert.equal(usuarios.length, 0);
            } finally {
                await alvo.end();
            }
        });

        it('carrega duas empresas, e não repete na segunda vez', async () => {
            await migrator.removerBanco(parcial);
            await migrator.criarBanco(parcial);
            await migrator.migrar(parcial);
            const alvo = await migrator.conectar(parcial);
            try {
                assert.equal(await carregarFixtures(alvo, { senha: 'senha-ficticia' }), true);
                assert.equal(await carregarFixtures(alvo, { senha: 'senha-ficticia' }), false);

                const [empresas] = await alvo.query<RowDataPacket[]>('SELECT id FROM empresas');
                assert.equal(empresas.length, 2);
                const [usuarios] = await alvo.query<RowDataPacket[]>('SELECT id, funcionario_id, empresa_id, senha, perfil FROM usuarios');
                const vinculados = usuarios.filter((u) => u.funcionario_id !== null);
                assert.ok(vinculados.length >= 4);
                assert.ok(vinculados.every((u) => u.id !== u.funcionario_id), 'usuario.id nunca coincide com o funcionario.id vinculado');
                assert.deepEqual([...new Set(usuarios.map((u) => u.perfil))].sort(), ['Administrador', 'Colaborador', 'RH']);
                assert.equal(await bcrypt.compare('senha-ficticia', usuarios[0].senha), true);

                const [pontos] = await alvo.query<RowDataPacket[]>('SELECT DISTINCT empresa_id FROM registro_pontos');
                assert.equal(pontos.length, 2);
            } finally {
                await alvo.end();
            }
        });
    });
});
