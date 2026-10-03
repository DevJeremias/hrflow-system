// B-22: as migrations 0016 a 0019 sobre um banco que já tem dados. A foto sai de usuarios e funcionarios
// (base64) para avatares (binário), e quem já era colaborador entra no histórico contratual.
// Banco e variáveis em tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST o teste é pulado.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import * as banco from './support/bancoDeTeste.ts';
import * as migrator from '../shared/db/migrator.ts';
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

describe('migrations de auditoria, histórico, avatares e LGPD (0016 a 0019)', { skip: banco.skip }, () => {
    const parcial = { ...banco.config, database: `${banco.config.database}_lgpd` };
    let conexao: Connection;
    let empresa: number;
    const ids: Record<string, number> = {};
    let png: Buffer;
    let miniatura: Buffer;

    const inserir = async (sql: string, valores: unknown[]) => (await conexao.query<ResultSetHeader>(sql, valores))[0].insertId;
    const consultar = async (sql: string, valores: unknown[] = []) => (await conexao.query<RowDataPacket[]>(sql, valores))[0];

    before(async () => {
        await banco.preparar();
        await migrator.removerBanco(parcial);
        await migrator.criarBanco(parcial);
        await migrator.migrar(parcial, () => {}, { ate: '0015' });
        conexao = await migrator.conectar(parcial);

        png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#336699' } }).png().toBuffer();
        miniatura = await sharp(png).resize(128, 128).webp().toBuffer();
        empresa = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia Migracao']);
        const [[{ cargo, departamento }]] = await conexao.query<RowDataPacket[]>(
            'SELECT (SELECT MIN(id) FROM cargos WHERE empresa_id = ?) AS cargo, (SELECT MIN(id) FROM departamentos WHERE empresa_id = ?) AS departamento', [empresa, empresa]
        );
        ids.cargo = cargo;
        ids.departamento = departamento;

        ids.comAdmissao = await inserir(
            'INSERT INTO funcionarios (nome, email, salario_base, cargo_id, departamento_id, data_admissao, empresa_id, avatar) VALUES (?, ?, 3200.50, ?, ?, ?, ?, ?)',
            ['Ana Ficticia', 'ana.migracao@exemplo.invalid', cargo, departamento, '2022-03-01', empresa, 'data:image/png;base64,AAAA']
        );
        ids.semAdmissao = await inserir('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['Bia Ficticia', 'bia.migracao@exemplo.invalid', empresa]);
        const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
        ids.comFoto = await inserir(
            'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, funcionario_id, avatar, avatar_miniatura, avatar_atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ['Ana Ficticia', 'ana.conta@exemplo.invalid', 'hash-ficticio', 'Colaborador', empresa, ids.comAdmissao, dataUrl, miniatura, '2026-05-06 10:20:30.123']
        );
        ids.fotoAntigaSemMiniatura = await inserir(
            'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, avatar) VALUES (?, ?, ?, ?, ?, ?)',
            ['Admin Ficticio', 'admin.migracao@exemplo.invalid', 'hash-ficticio', 'Administrador', empresa, `data:image/jpeg;base64,${png.toString('base64')}`]
        );
        ids.fotoQuebrada = await inserir(
            'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, avatar) VALUES (?, ?, ?, ?, ?, ?)',
            ['RH Ficticio', 'rh.migracao@exemplo.invalid', 'hash-ficticio', 'RH', empresa, 'isto não é um data URL']
        );
        ids.semFoto = await inserir('INSERT INTO usuarios (nome, email, senha, perfil, empresa_id) VALUES (?, ?, ?, ?, ?)', ['Sem Foto', 'semfoto.migracao@exemplo.invalid', 'hash-ficticio', 'RH', empresa]);

        assert.deepEqual(await migrator.migrar(parcial), ['0016', '0017', '0018', '0019']);
    });

    after(async () => {
        if (conexao) await conexao.end();
        await migrator.removerBanco(parcial);
        await banco.encerrar();
    });

    it('a foto em base64 vira binário em avatares, com o tipo, a miniatura e a data que já existiam', async () => {
        const [linha] = await consultar('SELECT tipo, imagem, miniatura, UNIX_TIMESTAMP(atualizado_em) AS instante FROM avatares WHERE usuario_id = ?', [ids.comFoto]);
        assert.equal(linha.tipo, 'image/png');
        assert.ok(linha.imagem.equals(png), 'o original volta byte a byte');
        assert.ok(linha.miniatura.equals(miniatura));
        assert.ok(Math.abs(Number(linha.instante) - Number((await consultar("SELECT UNIX_TIMESTAMP('2026-05-06 10:20:30.123') AS instante"))[0].instante)) < 1, 'a versão da URL se mantém');
    });

    it('quem tinha só o original fica sem miniatura (ela é gerada na primeira leitura); sem foto ou com foto quebrada não vira linha', async () => {
        const [antiga] = await consultar('SELECT tipo, miniatura FROM avatares WHERE usuario_id = ?', [ids.fotoAntigaSemMiniatura]);
        assert.equal(antiga.tipo, 'image/jpeg');
        assert.equal(antiga.miniatura, null);
        assert.equal((await consultar('SELECT 1 FROM avatares WHERE usuario_id IN (?, ?)', [ids.fotoQuebrada, ids.semFoto])).length, 0);
    });

    it('as colunas com a foto em base64 deixam de existir em usuarios e funcionarios', async () => {
        const colunas = await consultar(
            "SELECT table_name AS tabela, column_name AS coluna FROM information_schema.columns WHERE table_schema = ? AND column_name LIKE 'avatar%' AND table_name IN ('usuarios', 'funcionarios')",
            [parcial.database]
        );
        assert.deepEqual(colunas, []);
    });

    it('quem já era colaborador entra no histórico contratual com a situação de hoje, vigente desde a admissão ou o cadastro', async () => {
        const [ana] = await consultar("SELECT salario_base, cargo, departamento, DATE_FORMAT(vigencia_inicio, '%Y-%m-%d') AS inicio, vigencia_fim FROM historico_contratual WHERE funcionario_id = ?", [ids.comAdmissao]);
        const [[{ cargo }]] = await conexao.query<RowDataPacket[]>('SELECT nome AS cargo FROM cargos WHERE id = ?', [ids.cargo]);
        const [[{ departamento }]] = await conexao.query<RowDataPacket[]>('SELECT nome AS departamento FROM departamentos WHERE id = ?', [ids.departamento]);
        assert.deepEqual({ ...ana }, { salario_base: '3200.50', cargo, departamento, inicio: '2022-03-01', vigencia_fim: null });

        const [bia] = await consultar("SELECT salario_base, cargo, DATE_FORMAT(vigencia_inicio, '%Y-%m-%d') AS inicio, DATE_FORMAT(CURRENT_DATE, '%Y-%m-%d') AS hoje FROM historico_contratual WHERE funcionario_id = ?", [ids.semAdmissao]);
        assert.equal(bia.salario_base, null);
        assert.equal(bia.cargo, null);
        assert.ok(bia.inicio === bia.hoje || bia.inicio >= '2026-01-01', 'sem admissão, vale desde o cadastro');
    });

    it('cria a trilha de auditoria vazia, o histórico com a regra de vigência e o pedido de alteração', async () => {
        assert.equal((await consultar('SELECT COUNT(*) AS n FROM auditoria'))[0].n, 0);
        await assert.rejects(
            conexao.query("INSERT INTO historico_contratual (empresa_id, funcionario_id, vigencia_inicio, vigencia_fim) VALUES (?, ?, '2026-05-10', '2026-05-09')", [empresa, ids.comAdmissao]),
            { code: 'ER_CHECK_CONSTRAINT_VIOLATED' }
        );
        const outraEmpresa = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Outra Empresa Ficticia']);
        await assert.rejects(
            conexao.query("INSERT INTO solicitacoes_alteracao (empresa_id, usuario_id, funcionario_id, alteracoes, anteriores) VALUES (?, ?, ?, '{}', '{}')", [outraEmpresa, ids.comFoto, ids.semAdmissao]),
            { code: 'ER_NO_REFERENCED_ROW_2' }
        );
    });
});
