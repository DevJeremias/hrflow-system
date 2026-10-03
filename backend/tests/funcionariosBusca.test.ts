// Busca e filtros de GET /api/funcionarios. Exige um MySQL real (variáveis HRFLOW_TEST_DB_*, veja
// tests/support/bancoDeTeste.ts): sem ele os testes são marcados como ignorados, nunca como aprovados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import express from 'express';
import db from '../shared/db/pool.ts';
import authMiddleware from '../shared/middlewares/authMiddleware.ts';
import tratarErros from '../shared/middlewares/tratarErros.ts';
import { funcionariosRoutes } from '../modules/funcionarios/index.ts';

describe('busca de funcionários', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let baseUrl: string;
    let empresaA: number;
    let empresaB: number;
    let departamentos: { id: number; nome: string }[];
    let cargo: number;
    const tokens: Record<string, string> = {};

    const listar = async (consulta: string, token = tokens.rh) => {
        const resposta = await fetch(`${baseUrl}/api/funcionarios${consulta}`, { headers: cabecalhosDaSessao(token) });
        return { status: resposta.status, corpo: await resposta.json(), total: resposta.headers.get('X-Total-Count') };
    };
    const nomes = (corpo: { nome: string }[]) => corpo.map((f) => f.nome);

    const inserir = async (empresaId: number, nome: string, extra: Record<string, unknown> = {}): Promise<number> => {
        const dados = { nome, email: `${nome.toLowerCase().replace(/\W+/g, '.')}.${empresaId}@exemplo.invalid`, empresa_id: empresaId, ...extra };
        const colunas = Object.keys(dados);
        const [r] = await db.query<ResultSetHeader>(
            `INSERT INTO funcionarios (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`, Object.values(dados)
        );
        return r.insertId;
    };

    before(async () => {
        await banco.preparar();

        const app = express();
        app.use(express.json({ limit: '4mb' }));
        app.use('/api/funcionarios', authMiddleware, funcionariosRoutes);
        app.use(tratarErros);
        servidor = http.createServer(app);
        await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

        empresaA = (await db.query<ResultSetHeader>('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia A']))[0].insertId;
        empresaB = (await db.query<ResultSetHeader>('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia B']))[0].insertId;
        tokens.rh = (await criarUsuario(db, { empresaId: empresaA, perfil: 'RH' })).token;
        tokens.colaborador = (await criarUsuario(db, { empresaId: empresaA, perfil: 'Colaborador' })).token;
        tokens.adminB = (await criarUsuario(db, { empresaId: empresaB, perfil: 'Administrador' })).token;

        [departamentos] = await db.query<(RowDataPacket & { id: number; nome: string })[]>(
            'SELECT id, nome FROM departamentos WHERE empresa_id = ? ORDER BY id', [empresaA]
        );
        cargo = (await db.query<ResultSetHeader>(
            'INSERT INTO cargos (nome, nivel, departamento_id, empresa_id) VALUES (?, ?, ?, ?)', ['Analista Zeta', 'Pleno', departamentos[0].id, empresaA]
        ))[0].insertId;

        // 52 colaboradores: em ordem alfabética (e de id) "Gamma Pessoa 52" é o último e fica fora da página de 50.
        for (let i = 1; i <= 51; i += 1) await inserir(empresaA, `Alfa Pessoa ${String(i).padStart(2, '0')}`);
        await inserir(empresaA, 'Gamma Pessoa 52', { cargo_id: cargo, departamento_id: departamentos[0].id, cpf: '11122233344' });
        await inserir(empresaB, 'Gamma Pessoa Alheia');
    });

    after(async () => {
        await new Promise((resolve) => servidor?.close(resolve));
        await db.end();
        await banco.encerrar();
    });

    it('encontra um colaborador fora da primeira página', async () => {
        const pagina = await listar('?limite=50');
        assert.equal(pagina.total, '52');
        assert.equal(pagina.corpo.length, 50);
        assert.ok(!nomes(pagina.corpo).includes('Gamma Pessoa 52'));

        const busca = await listar('?busca=Gamma%20Pessoa%2052');
        assert.equal(busca.status, 200);
        assert.deepEqual(nomes(busca.corpo), ['Gamma Pessoa 52']);
        assert.equal(busca.total, '1');
    });

    it('ignora maiúsculas e acentos e procura em e-mail, CPF, cargo e departamento', async () => {
        assert.deepEqual(nomes((await listar('?busca=gamma')).corpo), ['Gamma Pessoa 52']);
        assert.deepEqual(nomes((await listar('?busca=pessoa%2052')).corpo), ['Gamma Pessoa 52']);
        assert.deepEqual(nomes((await listar('?busca=gamma.pessoa.52')).corpo), ['Gamma Pessoa 52'], 'e-mail');
        assert.deepEqual(nomes((await listar('?busca=111.222.333')).corpo), ['Gamma Pessoa 52'], 'CPF');
        assert.deepEqual(nomes((await listar('?busca=analista%20zeta')).corpo), ['Gamma Pessoa 52'], 'cargo');
        assert.deepEqual(nomes((await listar(`?busca=${encodeURIComponent(departamentos[0].nome)}`)).corpo), ['Gamma Pessoa 52'], 'departamento');
    });

    it('trata % e _ como texto, não como curinga', async () => {
        assert.equal((await listar('?busca=%25')).total, '0');
        assert.equal((await listar('?busca=_')).total, '0');
        assert.equal((await listar('?busca=Alfa%20Pessoa%20_1')).total, '0');
        await inserir(empresaA, '100% Ficticio_Nome');
        assert.deepEqual(nomes((await listar('?busca=100%25')).corpo), ['100% Ficticio_Nome']);
        assert.deepEqual(nomes((await listar('?busca=io_N')).corpo), ['100% Ficticio_Nome']);
        await db.query('DELETE FROM funcionarios WHERE nome = ?', ['100% Ficticio_Nome']);
    });

    it('filtra por status e por departamento, e combina com a busca', async () => {
        const inativo = await inserir(empresaA, 'Zulu Inativo', { status: 'Inativo', departamento_id: departamentos[1].id });
        const ferias = await inserir(empresaA, 'Zulu Ferias', { status: 'Férias', departamento_id: departamentos[1].id });

        assert.deepEqual(nomes((await listar('?status=Inativo')).corpo), ['Zulu Inativo']);
        assert.deepEqual(nomes((await listar(`?status=${encodeURIComponent('Férias')}`)).corpo), ['Zulu Ferias']);
        assert.equal((await listar('?status=Ativo')).total, '52');

        const departamento = await listar(`?departamento_id=${departamentos[1].id}`);
        assert.deepEqual(nomes(departamento.corpo), ['Zulu Ferias', 'Zulu Inativo']);
        assert.equal(departamento.total, '2');

        assert.deepEqual(nomes((await listar(`?departamento_id=${departamentos[1].id}&status=Inativo&busca=zulu`)).corpo), ['Zulu Inativo']);
        assert.equal((await listar(`?departamento_id=${departamentos[0].id}&status=Inativo`)).total, '0');

        await db.query('DELETE FROM funcionarios WHERE id IN (?, ?)', [inativo, ferias]);
    });

    it('o total do cabeçalho segue o filtro e a paginação do resultado filtrado', async () => {
        const primeira = await listar('?busca=Alfa&limite=20&pagina=1');
        const ultima = await listar('?busca=Alfa&limite=20&pagina=3');
        assert.equal(primeira.total, '51');
        assert.equal(primeira.corpo.length, 20);
        assert.equal(ultima.total, '51');
        assert.equal(ultima.corpo.length, 11);
    });

    it('lista em ordem alfabética, sem repetir nem pular ninguém entre páginas', async () => {
        const vistos: string[] = [];
        for (let pagina = 1; pagina <= 3; pagina += 1) vistos.push(...nomes((await listar(`?limite=20&pagina=${pagina}`)).corpo));
        assert.equal(vistos.length, 52);
        assert.deepEqual(vistos, [...vistos].sort((a, b) => a.localeCompare(b)));
    });

    it('nunca mistura empresas', async () => {
        assert.deepEqual(nomes((await listar('?busca=Gamma')).corpo), ['Gamma Pessoa 52']);
        const deB = await listar('?busca=Gamma', tokens.adminB);
        assert.deepEqual(nomes(deB.corpo), ['Gamma Pessoa Alheia']);
        assert.equal(deB.total, '1');
    });

    it('a listagem traz o que a tela usa e nunca o avatar', async () => {
        const { corpo } = await listar('?busca=Gamma%20Pessoa%2052');
        assert.deepEqual(Object.keys(corpo[0]).sort(), [
            'agencia', 'anonimizado', 'bairro', 'banco', 'cargo_id', 'cargo_nome', 'cep', 'cidade', 'complemento', 'conta', 'contato_emergencia_nome',
            'contato_emergencia_parentesco', 'contato_emergencia_telefone', 'cpf', 'ctps', 'data_admissao', 'data_desligamento',
            'data_nascimento', 'departamento_id', 'departamento_nome', 'email', 'empresa_id', 'endereco', 'id', 'logradouro', 'matricula',
            'motivo_desligamento', 'nivel', 'nome', 'numero', 'pis', 'rg', 'salario_base', 'status', 'telefone', 'tem_movimento',
            'tipo_conta', 'tipo_contrato', 'uf', 'usuario_perfil',
        ]);
        assert.equal(corpo[0].cargo_nome, 'Analista Zeta');
        assert.equal(corpo[0].departamento_nome, departamentos[0].nome);
    });

    it('recusa parâmetros inválidos com 400', async () => {
        for (const consulta of ['?status=Demitido', '?departamento_id=abc', '?departamento_id=0', `?busca=${'a'.repeat(101)}`, '?busca=a&busca=b']) {
            const { status, corpo } = await listar(consulta);
            assert.equal(status, 400, consulta);
            assert.ok(corpo.erro, consulta);
        }
    });

    it('busca vazia lista todos, e o Colaborador continua sem acesso', async () => {
        assert.equal((await listar('?busca=%20%20')).total, '52');
        assert.equal((await listar('?busca=Gamma', tokens.colaborador)).status, 403);
    });
});
