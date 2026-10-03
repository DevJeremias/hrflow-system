// Contrato HTTP de funcionários (/api/funcionarios): quem acessa, o que cada rota responde e o que
// ela grava. Exige um MySQL real (variáveis HRFLOW_TEST_DB_*, veja tests/support/bancoDeTeste.ts):
// sem ele os testes são marcados como ignorados, nunca como aprovados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import express from 'express';
import bcrypt from 'bcrypt';
import db from '../shared/db/pool.ts';
import authMiddleware from '../shared/middlewares/authMiddleware.ts';
import tratarErros from '../shared/middlewares/tratarErros.ts';
import { funcionariosRoutes } from '../modules/funcionarios/index.ts';

describe('funcionários', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let baseUrl: string;
    let empresaA: number;
    let empresaB: number;
    const tokens: Record<string, string> = {};

    const chamar = async (metodo: string, caminho: string, token: string | undefined, corpo?: unknown) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        return { status: resposta.status, corpo: await resposta.json(), total: resposta.headers.get('X-Total-Count') };
    };

    const consultar = async <T extends RowDataPacket>(sql: string, valores: unknown[]): Promise<T[]> => (await db.query<T[]>(sql, valores))[0];
    const inserirFuncionario = async (nome: string, email: string, empresaId: number): Promise<number> =>
        (await db.query<ResultSetHeader>('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', [nome, email, empresaId]))[0].insertId;

    let sequencia = 0;
    const novoCadastro = (extra: Record<string, unknown> = {}) => {
        sequencia += 1;
        return { nome: `Pessoa Ficticia ${sequencia}`, email: `funcionarios.${sequencia}@exemplo.invalid`, senha: 'senha-ficticia', ...extra };
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
        tokens.admin = (await criarUsuario(db, { empresaId: empresaA, perfil: 'Administrador' })).token;
        tokens.rh = (await criarUsuario(db, { empresaId: empresaA, perfil: 'RH' })).token;
        tokens.adminB = (await criarUsuario(db, { empresaId: empresaB, perfil: 'Administrador' })).token;
        const colaborador = await inserirFuncionario('Colaborador Ficticio', 'colaborador.funcionarios@exemplo.invalid', empresaA);
        tokens.colaborador = (await criarUsuario(db, { empresaId: empresaA, perfil: 'Colaborador', funcionarioId: colaborador })).token;
    });

    after(async () => {
        await new Promise((resolve) => servidor?.close(resolve));
        await db.end();
        await banco.encerrar();
    });

    describe('acesso', () => {
        const rotas: Array<[string, string, unknown]> = [
            ['GET', '/api/funcionarios', undefined],
            ['POST', '/api/funcionarios', { nome: 'x', email: 'x@exemplo.invalid', senha: 'senha-ficticia' }],
            ['PUT', '/api/funcionarios/1', { nome: 'x', email: 'x@exemplo.invalid' }],
            ['DELETE', '/api/funcionarios/1', undefined],
        ];

        for (const [metodo, caminho, corpo] of rotas) {
            it(`${metodo} recusa o Colaborador com 403 e sem sessão com 401`, async () => {
                const colaborador = await chamar(metodo, caminho, tokens.colaborador, corpo);
                assert.equal(colaborador.status, 403);
                assert.equal(colaborador.corpo.erro, 'Acesso negado. Seu perfil não tem permissão para esta ação.');
                assert.equal((await chamar(metodo, caminho, undefined, corpo)).status, 401);
            });
        }

        it('RH tem o mesmo acesso do Administrador', async () => {
            const { status, corpo } = await chamar('POST', '/api/funcionarios', tokens.rh, novoCadastro());
            assert.equal(status, 201, JSON.stringify(corpo));
            assert.equal((await chamar('GET', '/api/funcionarios', tokens.rh)).status, 200);
        });
    });

    describe('cadastro', () => {
        it('cria o colaborador Ativo com acesso próprio, senha em hash e mensagem de sucesso', async () => {
            const entrada = novoCadastro({ cpf: '000.000.000-01', salario_base: '3500.50', status: 'Inativo' });
            const { status, corpo } = await chamar('POST', '/api/funcionarios', tokens.admin, entrada);
            assert.equal(status, 201);
            assert.deepEqual(corpo, { mensagem: 'Colaborador e credenciais de acesso criados com sucesso!' });

            const [pessoa] = await consultar('SELECT id, status, empresa_id, salario_base FROM funcionarios WHERE email = ?', [entrada.email]);
            assert.equal(pessoa.status, 'Ativo', 'o status do cadastro novo não vem do cliente');
            assert.equal(pessoa.empresa_id, empresaA);
            assert.equal(Number(pessoa.salario_base), 3500.5);

            const [acesso] = await consultar('SELECT nome, perfil, empresa_id, funcionario_id, senha FROM usuarios WHERE email = ?', [entrada.email]);
            assert.equal(acesso.perfil, 'Colaborador');
            assert.equal(acesso.nome, entrada.nome);
            assert.equal(acesso.empresa_id, empresaA);
            assert.equal(acesso.funcionario_id, pessoa.id);
            assert.notEqual(acesso.senha, entrada.senha);
            assert.equal(await bcrypt.compare(entrada.senha, acesso.senha), true);
        });

        it('e-mail já usado, mesmo por outra empresa, é 400 com detalhes e não grava nada', async () => {
            const entrada = novoCadastro();
            assert.equal((await chamar('POST', '/api/funcionarios', tokens.admin, entrada)).status, 201);
            const antes = (await consultar('SELECT COUNT(*) AS total FROM funcionarios', []))[0].total;

            const { status, corpo } = await chamar('POST', '/api/funcionarios', tokens.adminB, novoCadastro({ email: entrada.email }));
            assert.equal(status, 400);
            assert.equal(corpo.erro, 'Este e-mail já está registado no sistema.');
            assert.deepEqual(corpo.detalhes, [{ campo: 'email', mensagem: 'Este e-mail já está registado no sistema.' }]);
            assert.equal((await consultar('SELECT COUNT(*) AS total FROM funcionarios', []))[0].total, antes);
        });

        it('cargo de outra empresa é 400 e não grava nada', async () => {
            const [cargoDeB] = await consultar('SELECT MIN(id) AS id FROM cargos WHERE empresa_id = ?', [empresaB]);
            const entrada = novoCadastro({ cargo_id: cargoDeB.id });
            const { status, corpo } = await chamar('POST', '/api/funcionarios', tokens.admin, entrada);
            assert.equal(status, 400);
            assert.equal(corpo.erro, 'Cargo não encontrado nesta empresa.');
            assert.equal((await consultar('SELECT id FROM funcionarios WHERE email = ?', [entrada.email])).length, 0);
            assert.equal((await consultar('SELECT id FROM usuarios WHERE email = ?', [entrada.email])).length, 0);
        });
    });

    describe('listagem', () => {
        it('lista só a empresa do token, com cargo e departamento, e o total no X-Total-Count', async () => {
            const { status, corpo, total } = await chamar('GET', '/api/funcionarios', tokens.admin);
            assert.equal(status, 200);
            assert.ok(Array.isArray(corpo));
            assert.ok(corpo.length > 0);
            assert.ok(corpo.every((f: { empresa_id: number }) => f.empresa_id === empresaA));
            assert.ok(corpo.every((f: object) => 'cargo_nome' in f && 'departamento_nome' in f));
            assert.equal(Number(total), (await consultar('SELECT COUNT(*) AS total FROM funcionarios WHERE empresa_id = ?', [empresaA]))[0].total);
        });

        it('pagina por id e mantém o total da empresa', async () => {
            const todos = (await chamar('GET', '/api/funcionarios', tokens.admin)).corpo;
            assert.ok(todos.length >= 3);
            const pagina = await chamar('GET', '/api/funcionarios?pagina=2&limite=2', tokens.admin);
            assert.deepEqual(pagina.corpo.map((f: { id: number }) => f.id), todos.slice(2, 4).map((f: { id: number }) => f.id));
            assert.equal(Number(pagina.total), todos.length);
        });

        it('página fora do intervalo é 400', async () => {
            assert.equal((await chamar('GET', '/api/funcionarios?limite=0', tokens.admin)).status, 400);
        });
    });

    describe('edição', () => {
        it('atualiza o funcionário e sincroniza nome e e-mail do acesso', async () => {
            const entrada = novoCadastro();
            await chamar('POST', '/api/funcionarios', tokens.admin, entrada);
            const [pessoa] = await consultar('SELECT id FROM funcionarios WHERE email = ?', [entrada.email]);

            const novoEmail = `editado.${pessoa.id}@exemplo.invalid`;
            const { status, corpo } = await chamar('PUT', `/api/funcionarios/${pessoa.id}`, tokens.admin, { nome: 'Nome Editado', email: novoEmail, status: 'Férias' });
            assert.equal(status, 200);
            assert.deepEqual(corpo, { mensagem: 'Funcionário atualizado com sucesso!' });

            const [atualizado] = await consultar('SELECT nome, email, status FROM funcionarios WHERE id = ?', [pessoa.id]);
            assert.deepEqual({ ...atualizado }, { nome: 'Nome Editado', email: novoEmail, status: 'Férias' });
            const [acesso] = await consultar('SELECT nome, email, sessao_versao FROM usuarios WHERE funcionario_id = ?', [pessoa.id]);
            assert.equal(acesso.nome, 'Nome Editado');
            assert.equal(acesso.email, novoEmail);
        });

        it('só Inativo derruba as sessões abertas', async () => {
            const entrada = novoCadastro();
            await chamar('POST', '/api/funcionarios', tokens.admin, entrada);
            const [pessoa] = await consultar('SELECT id FROM funcionarios WHERE email = ?', [entrada.email]);
            const versao = async () => (await consultar('SELECT sessao_versao FROM usuarios WHERE funcionario_id = ?', [pessoa.id]))[0].sessao_versao;
            const inicial = await versao();

            await chamar('PUT', `/api/funcionarios/${pessoa.id}`, tokens.admin, { nome: entrada.nome, email: entrada.email, status: 'Férias' });
            assert.equal(await versao(), inicial);
            await chamar('PUT', `/api/funcionarios/${pessoa.id}`, tokens.admin, { nome: entrada.nome, email: entrada.email, status: 'Inativo' });
            assert.equal(await versao(), inicial + 1);
        });

        it('funcionário inexistente ou de outra empresa é 404 e nada é alterado', async () => {
            const deB = await inserirFuncionario('Pessoa de B', 'pessoa.b.funcionarios@exemplo.invalid', empresaB);
            for (const id of [999999, deB]) {
                const { status, corpo } = await chamar('PUT', `/api/funcionarios/${id}`, tokens.admin, { nome: 'Invasor', email: 'invasor@exemplo.invalid' });
                assert.equal(status, 404);
                assert.equal(corpo.erro, 'Funcionário não encontrado.');
            }
            assert.equal((await consultar('SELECT nome FROM funcionarios WHERE id = ?', [deB]))[0].nome, 'Pessoa de B');
        });

        it('cargo de outra empresa é 400 e não altera o funcionário', async () => {
            const entrada = novoCadastro();
            await chamar('POST', '/api/funcionarios', tokens.admin, entrada);
            const [pessoa] = await consultar('SELECT id FROM funcionarios WHERE email = ?', [entrada.email]);
            const [cargoDeB] = await consultar('SELECT MIN(id) AS id FROM cargos WHERE empresa_id = ?', [empresaB]);
            const { status, corpo } = await chamar('PUT', `/api/funcionarios/${pessoa.id}`, tokens.admin, { nome: 'Outro Nome', email: entrada.email, cargo_id: cargoDeB.id });
            assert.equal(status, 400);
            assert.equal(corpo.erro, 'Cargo não encontrado nesta empresa.');
            assert.equal((await consultar('SELECT nome FROM funcionarios WHERE id = ?', [pessoa.id]))[0].nome, entrada.nome);
        });
    });

    describe('exclusão', () => {
        it('remove o funcionário e o acesso dele', async () => {
            const entrada = novoCadastro();
            await chamar('POST', '/api/funcionarios', tokens.admin, entrada);
            const [pessoa] = await consultar('SELECT id FROM funcionarios WHERE email = ?', [entrada.email]);

            const { status, corpo } = await chamar('DELETE', `/api/funcionarios/${pessoa.id}`, tokens.admin);
            assert.equal(status, 200);
            assert.deepEqual(corpo, { mensagem: 'Funcionário removido com sucesso!' });
            assert.equal((await consultar('SELECT id FROM funcionarios WHERE id = ?', [pessoa.id])).length, 0);
            assert.equal((await consultar('SELECT id FROM usuarios WHERE email = ?', [entrada.email])).length, 0);
        });

        it('funcionário de outra empresa é 404 e mantém o funcionário e o acesso dele', async () => {
            const entrada = novoCadastro();
            await chamar('POST', '/api/funcionarios', tokens.adminB, entrada);
            const [pessoa] = await consultar('SELECT id FROM funcionarios WHERE email = ?', [entrada.email]);

            const { status, corpo } = await chamar('DELETE', `/api/funcionarios/${pessoa.id}`, tokens.admin);
            assert.equal(status, 404);
            assert.equal(corpo.erro, 'Funcionário não encontrado.');
            assert.equal((await consultar('SELECT id FROM funcionarios WHERE id = ?', [pessoa.id])).length, 1);
            assert.equal((await consultar('SELECT id FROM usuarios WHERE email = ?', [entrada.email])).length, 1);
        });

        it('identificador inválido é 400', async () => {
            assert.equal((await chamar('DELETE', '/api/funcionarios/abc', tokens.admin)).status, 400);
        });
    });
});
