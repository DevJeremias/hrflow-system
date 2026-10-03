// Teste de integração do holerite individual contra um MySQL de teste descartável, com o schema
// aplicado pelas migrations (tests/support/bancoDeTeste.ts, variáveis HRFLOW_TEST_DB_*): a identidade
// vem do vínculo usuário/funcionário, não do id. Sem HRFLOW_TEST_DB_HOST o teste é pulado, não aprovado.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { autoriaDeTeste } from './support/auditoria.ts';
import db from '../shared/db/pool.ts';
import { meuHolerite } from '../modules/folha/folha.controller.ts';
import * as service from '../modules/folha/folha.service.ts';

type Token = NonNullable<Request['usuario']>;

interface RespostaFalsa {
    statusCode: number;
    corpo: any;
    status: (codigo: number) => RespostaFalsa;
    json: (corpo: unknown) => RespostaFalsa;
}

const respostaFalsa = (): RespostaFalsa => {
    const res: RespostaFalsa = {
        statusCode: 200,
        corpo: undefined,
        status: (codigo) => { res.statusCode = codigo; return res; },
        json: (corpo) => { res.corpo = corpo; return res; },
    };
    return res;
};

test('meuHolerite resolve a identidade pelo vínculo usuário/funcionário', { skip: banco.skip }, async (t) => {
    await banco.preparar();

    t.after(async () => {
        await db.end();
        await banco.encerrar();
    });

    const inserir = async (sql: string, valores: unknown[]) => (await db.query<ResultSetHeader>(sql, valores))[0].insertId;
    const empresaA = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Fictícia A']);
    const empresaB = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Fictícia B']);
    // Cargo e departamento vêm do trigger de empresa nova (migration 0002).
    const [[{ cargo }]] = await db.query<RowDataPacket[]>('SELECT MIN(id) AS cargo FROM cargos WHERE empresa_id = ?', [empresaA]);
    const [[{ departamento }]] = await db.query<RowDataPacket[]>('SELECT MIN(id) AS departamento FROM departamentos WHERE empresa_id = ?', [empresaA]);

    const funcionario = (nome: string, salario: number, status: string, empresa: number) => inserir(
        'INSERT INTO funcionarios (nome, email, salario_base, status, cargo_id, departamento_id, empresa_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nome, `${nome.split(' ')[0].toLowerCase()}@exemplo.invalid`, salario, status, ...(empresa === empresaA ? [cargo, departamento] : [null, null]), empresa]
    );
    const usuario = (nome: string, perfil: string, empresa: number, funcionarioId: number | null) => inserir(
        'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, funcionario_id) VALUES (?, ?, ?, ?, ?, ?)',
        [nome, `${nome.replace(/\s/g, '.').toLowerCase()}@exemplo.invalid`, 'hash-ficticio', perfil, empresa, funcionarioId]
    );

    // Os ids das duas tabelas são deliberadamente diferentes: o usuário de Bruno tem o mesmo
    // id que Carla, que é outra pessoa da mesma empresa e não tem usuário.
    const ana = await funcionario('Ana Teste', 2000.00, 'Ativo', empresaA);
    const bruno = await funcionario('Bruno Teste', 2500.00, 'Ativo', empresaA);
    const carla = await funcionario('Carla Teste', 4000.00, 'Ativo', empresaA);
    const davi = await funcionario('Davi Teste', 3000.00, 'Inativo', empresaA);
    const elisa = await funcionario('Elisa Teste', 3500.00, 'Ativo', empresaB);

    const admin = await usuario('Admin Teste', 'Administrador', empresaA, null);
    await usuario('Ana Usuária', 'Colaborador', empresaA, ana);
    const usuarioBruno = await usuario('Bruno Usuário', 'Colaborador', empresaA, bruno);
    const usuarioDavi = await usuario('Davi Usuário', 'Colaborador', empresaA, davi);
    const usuarioElisa = await usuario('Elisa Usuária', 'Colaborador', empresaB, elisa);
    const usuarioAnaSemColisao = await usuario('Ana Sem Colisão', 'Colaborador', empresaA, ana);

    assert.equal(usuarioBruno, carla, 'o teste depende do id do usuário de Bruno ser o id de Carla');
    assert.notEqual(usuarioBruno, bruno);
    assert.ok(usuarioAnaSemColisao > elisa, 'nenhum funcionário tem o id deste usuário');

    // Folha de outubro fechada com o cadastro como está: Davi (inativo) fica fora, Elisa é da empresa B.
    await db.query('UPDATE empresas SET razao_social = ?, cnpj = ? WHERE id = ?', ['Razao Social Ficticia A Ltda', '11222333000181', empresaA]);
    await service.processarFolha({ empresaId: empresaA, competencia: '2026-10', autoria: autoriaDeTeste(empresaA, admin) });
    await service.fecharFolha({ empresaId: empresaA, usuarioId: admin, competencia: '2026-10', autoria: autoriaDeTeste(empresaA, admin) });

    // O controller só lê id e empresa_id do token e a competência validada; o authMiddleware e o
    // validarEntrada garantem o resto em produção.
    const consultar = async (token: Partial<Token>, competencia = '2026-10') => {
        const res = respostaFalsa();
        await meuHolerite({ usuario: token, dadosValidados: { query: { competencia } } } as Request, res as unknown as Response);
        return res;
    };

    await t.test('entrega o holerite do funcionário vinculado, não o de mesmo id do usuário', async () => {
        const res = await consultar({ id: usuarioBruno, empresa_id: empresaA });
        assert.equal(res.statusCode, 200);
        assert.equal(res.corpo.id, String(bruno));
        assert.equal(res.corpo.name, 'Bruno Teste');
        assert.equal(res.corpo.baseSalary, 2500);
        assert.equal(res.corpo.role, 'Desenvolvedor(a)');
    });

    await t.test('não devolve 404 quando nenhum funcionário tem o id do usuário', async () => {
        const res = await consultar({ id: usuarioAnaSemColisao, empresa_id: empresaA });
        assert.equal(res.statusCode, 200);
        assert.equal(res.corpo.name, 'Ana Teste');
    });

    await t.test('ignora o funcionario_id do token e segue o vínculo vigente no banco', async () => {
        const res = await consultar({ id: usuarioBruno, empresa_id: empresaA, funcionario_id: carla });
        assert.equal(res.corpo.name, 'Bruno Teste');
    });

    await t.test('usuário sem vínculo recebe 404 mesmo havendo funcionário com o mesmo id', async () => {
        const res = await consultar({ id: admin, empresa_id: empresaA });
        assert.equal(admin, ana, 'o administrador tem o mesmo id da funcionária Ana');
        assert.equal(res.statusCode, 404);
        assert.equal(res.corpo.name, undefined);
    });

    await t.test('funcionário inativo recebe 404', async () => {
        const res = await consultar({ id: usuarioDavi, empresa_id: empresaA });
        assert.equal(res.statusCode, 404);
    });

    await t.test('vínculo com funcionário de outra empresa recebe 404', async () => {
        const res = await consultar({ id: usuarioElisa, empresa_id: empresaA });
        assert.equal(res.statusCode, 404);
    });

    await t.test('empresa do token diferente da empresa do usuário recebe 404', async () => {
        const res = await consultar({ id: usuarioBruno, empresa_id: empresaB });
        assert.equal(res.statusCode, 404);
    });
});
