// SEC-07: entrada inválida nas rotas de funcionários, estrutura, folha e perfil vira 4xx
// acionável em vez de 500 do banco. Exige um MySQL real (variáveis HRFLOW_TEST_DB_*, veja
// tests/support/bancoDeTeste.ts): sem ele os testes são marcados como ignorados, nunca como aprovados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcrypt';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { dataUrl } from './support/imagens.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import pool from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import authMiddleware from '../shared/middlewares/authMiddleware.ts';

describe('validação de entrada nas rotas', { skip: banco.skip }, () => {
    let server: http.Server, baseUrl: string;
    let empresaA: number, empresaB: number, usuarioAdmin: number, usuarioColaborador: number, funcionarioColaborador: number, deptoA: number, cargoA: number, cargoB: number;
    // O authMiddleware confere o usuário no banco: os tokens vêm de usuários reais (support/sessao.ts).
    const tokens: Record<string, string> = {};
    const tokenAdmin = () => tokens.adminA;

    const chamar = async (metodo: string, caminho: string, corpo?: unknown, { jwt = tokenAdmin(), bruto }: { jwt?: string; bruto?: string } = {}) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(jwt) },
            body: bruto ?? (corpo === undefined ? undefined : JSON.stringify(corpo)),
        });
        const texto = await resposta.text();
        let json: any;
        try { json = JSON.parse(texto); } catch { json = undefined; }
        return { status: resposta.status, corpo: json, texto, cabecalhos: resposta.headers };
    };

    const inserir = async (sql: string, valores: unknown[]) => (await pool.query<ResultSetHeader>(sql, valores))[0].insertId;
    const contar = async (tabela: string, empresa_id = empresaA) =>
        (await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM ${tabela} WHERE empresa_id = ?`, [empresa_id]))[0][0].total;

    let sequencia = 0;
    const novoFuncionario = (extra = {}) => {
        sequencia += 1;
        return { nome: `Pessoa Ficticia ${sequencia}`, email: `validacao.${sequencia}@exemplo.invalid`, senha: 'senha-ficticia', ...extra };
    };

    before(async () => {
        await banco.preparar();

        const app = criarApp();
        server = http.createServer(app);
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        empresaA = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia A']);
        empresaB = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia B']);
        const [[{ depto }]] = await pool.query<RowDataPacket[]>('SELECT MIN(id) AS depto FROM departamentos WHERE empresa_id = ?', [empresaA]);
        deptoA = depto;
        cargoA = (await pool.query<RowDataPacket[]>('SELECT MIN(id) AS id FROM cargos WHERE empresa_id = ?', [empresaA]))[0][0].id;
        cargoB = (await pool.query<RowDataPacket[]>('SELECT MIN(id) AS id FROM cargos WHERE empresa_id = ?', [empresaB]))[0][0].id;

        const senhaHash = await bcrypt.hash('senha-atual-ficticia', 4);
        const admin = await criarUsuario(pool, { empresaId: empresaA, perfil: 'Administrador', senhaHash });
        usuarioAdmin = admin.usuario.id;
        tokens.adminA = admin.token;
        tokens.adminB = (await criarUsuario(pool, { empresaId: empresaB, perfil: 'Administrador' })).token;
        funcionarioColaborador = await inserir(
            'INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['Colaborador Ficticio', 'colab.validacao@exemplo.invalid', empresaA]
        );
        // O e-mail do login vem de criarUsuario; o do funcionário é o que o teste de perfil reenvia.
        const colaborador = await criarUsuario(pool, { empresaId: empresaA, perfil: 'Colaborador', funcionarioId: funcionarioColaborador });
        usuarioColaborador = colaborador.usuario.id;
        tokens.colaborador = colaborador.token;
        await pool.query('UPDATE usuarios SET email = ? WHERE id = ?', ['colab.validacao@exemplo.invalid', usuarioColaborador]);
    });

    after(async () => {
        if (server) await new Promise((resolve) => server.close(resolve));
        if (pool) await pool.end();
        await banco.encerrar();
    });

    describe('funcionários', () => {
        it('cria o colaborador com todos os campos normalizados', async () => {
            const entrada = novoFuncionario({
                cpf: '000.000.000-01', telefone: '(00) 90000-0000', data_nascimento: '1990-05-17', data_admissao: '2024-02-29',
                endereco: 'Rua Ficticia, 1', banco: 'Banco Ficticio', agencia: '0001', conta: '12345-6', tipo_conta: 'Poupanca',
                cargo_id: cargoA, departamento_id: deptoA, tipo_contrato: 'Estágio', salario_base: '3500.50',
            });
            const { status } = await chamar('POST', '/api/funcionarios', entrada);
            assert.equal(status, 201);
            const [[pessoa]] = await pool.query<RowDataPacket[]>('SELECT * FROM funcionarios WHERE email = ?', [entrada.email]);
            assert.equal(pessoa.tipo_conta, 'Poupanca');
            assert.equal(pessoa.tipo_contrato, 'Estágio');
            assert.equal(Number(pessoa.salario_base), 3500.5);
            assert.equal(pessoa.status, 'Ativo');
        });

        it('aceita o payload que o formulário do front-end envia, com campos em branco', async () => {
            const { status } = await chamar('POST', '/api/funcionarios', novoFuncionario({
                cpf: '', telefone: '', data_nascimento: '', data_admissao: '', endereco: '', banco: '', agencia: '', conta: '',
                tipo_conta: '', nivel: 'Pleno', tipo_contrato: 'CLT', salario_base: '', cargo_id: null, departamento_id: null, status: 'Ativo',
            }));
            assert.equal(status, 201);
        });

        it('grava o nível hierárquico informado no cadastro e na edição', async () => {
            const entrada = novoFuncionario({ nivel: 'Pleno' });
            assert.equal((await chamar('POST', '/api/funcionarios', entrada)).status, 201);
            const [[criado]] = await pool.query<RowDataPacket[]>('SELECT id, nivel FROM funcionarios WHERE email = ?', [entrada.email]);
            assert.equal(criado.nivel, 'Pleno');

            const { senha, ...dados } = entrada;
            assert.ok(senha);
            assert.equal((await chamar('PUT', `/api/funcionarios/${criado.id}`, { ...dados, nivel: 'Sênior' })).status, 200);
            const [[editado]] = await pool.query<RowDataPacket[]>('SELECT nivel FROM funcionarios WHERE id = ?', [criado.id]);
            assert.equal(editado.nivel, 'Sênior');
        });

        it('recusa com 400 o campo que a API não conhece, em vez de descartá-lo', async () => {
            for (const [metodo, caminho, extra] of [['POST', '/api/funcionarios', novoFuncionario({ rg: '1234567' })], ['PUT', `/api/funcionarios/${funcionarioColaborador}`, { nome: 'Pessoa', email: 'x.desconhecido@exemplo.invalid', perfil: 'Administrador' }]] as [string, string, unknown][]) {
                const funcionarios = await contar('funcionarios');
                const { status, corpo } = await chamar(metodo, caminho, extra);
                assert.equal(status, 400, metodo);
                assert.match(corpo.erro, /campo desconhecido: (rg|perfil)/i);
                assert.equal(await contar('funcionarios'), funcionarios);
            }
        });

        it('devolve o campo do e-mail duplicado em detalhes, para a tela abrir a aba certa', async () => {
            const entrada = novoFuncionario();
            assert.equal((await chamar('POST', '/api/funcionarios', entrada)).status, 201);
            const { status, corpo } = await chamar('POST', '/api/funcionarios', { ...entrada, nome: 'Outra Pessoa' });
            assert.equal(status, 400);
            assert.equal(corpo.erro, 'Este e-mail já está registado no sistema.');
            assert.deepEqual(corpo.detalhes, [{ campo: 'email', mensagem: corpo.erro }]);
        });

        const recusas: Record<string, [object, RegExp]> = {
            'data de admissão inexistente': [{ data_admissao: '2024-13-45' }, /Data de admissão/],
            'admissão antes do nascimento': [{ data_nascimento: '2000-01-01', data_admissao: '1999-12-31' }, /anterior à data de nascimento/],
            'salário não numérico': [{ salario_base: 'abc' }, /Salário base/],
            'salário acima de DECIMAL(10,2)': [{ salario_base: 99999999999 }, /Salário base/],
            'salário negativo': [{ salario_base: -10 }, /Salário base/],
            'cpf acima da coluna': [{ cpf: 'x'.repeat(40) }, /CPF/],
            'tipo de contrato fora da lista': [{ tipo_contrato: 'Outro' }, /Tipo de contrato/],
            'cargo não numérico': [{ cargo_id: 'abc' }, /Cargo/],
            'senha curta': [{ senha: '123' }, /mínimo 8/],
        };
        for (const [nome, [extra, mensagem]] of Object.entries(recusas)) {
            it(`recusa ${nome} com 400, mensagem acionável e sem gravar nada`, async () => {
                const [funcionarios, usuarios] = [await contar('funcionarios'), await contar('usuarios')];
                const { status, corpo } = await chamar('POST', '/api/funcionarios', novoFuncionario(extra));
                assert.equal(status, 400);
                assert.match(corpo.erro, mensagem);
                assert.ok(Array.isArray(corpo.detalhes) && corpo.detalhes.length >= 1);
                assert.equal(await contar('funcionarios'), funcionarios);
                assert.equal(await contar('usuarios'), usuarios);
            });
        }

        it('recusa corpo que não é JSON válido com 400 em JSON, não HTML', async () => {
            const { status, corpo } = await chamar('POST', '/api/funcionarios', undefined, { bruto: '{nome: sem aspas' });
            assert.equal(status, 400);
            assert.match(corpo.erro, /JSON válido/);
        });

        it('recusa corpo acima de 4mb com 413', async () => {
            const { status, corpo } = await chamar('POST', '/api/funcionarios', novoFuncionario({ endereco: 'a'.repeat(5 * 1024 * 1024) }));
            assert.equal(status, 413);
            assert.match(corpo.erro, /limite/);
        });

        it('atualiza com status válido e rejeita status fora do ENUM com 400, não 500', async () => {
            const id = await inserir('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['Pessoa Edicao', 'edicao.validacao@exemplo.invalid', empresaA]);
            const corpoBase = { nome: 'Pessoa Edicao', email: 'edicao.validacao@exemplo.invalid' };

            const ferias = await chamar('PUT', `/api/funcionarios/${id}`, { ...corpoBase, status: 'Férias', salario_base: '1200' });
            assert.equal(ferias.status, 200);
            const [[linha]] = await pool.query<RowDataPacket[]>('SELECT status, salario_base FROM funcionarios WHERE id = ?', [id]);
            assert.equal(linha.status, 'Férias');
            assert.equal(Number(linha.salario_base), 1200);

            const invalido = await chamar('PUT', `/api/funcionarios/${id}`, { ...corpoBase, status: 'Demitido' });
            assert.equal(invalido.status, 400);
            assert.match(invalido.corpo.erro, /Status deve ser um destes valores/);
        });

        it('responde 404 ao atualizar ou remover funcionário inexistente ou de outra empresa', async () => {
            const deOutraEmpresa = await inserir('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['Pessoa B', 'b.validacao@exemplo.invalid', empresaB]);
            const entrada = { nome: 'Pessoa', email: 'x.validacao@exemplo.invalid' };
            assert.equal((await chamar('PUT', '/api/funcionarios/999999', entrada)).status, 404);
            assert.equal((await chamar('PUT', `/api/funcionarios/${deOutraEmpresa}`, entrada)).status, 404);
            assert.equal((await chamar('DELETE', '/api/funcionarios/999999')).status, 404);
            const [[intacto]] = await pool.query<RowDataPacket[]>('SELECT nome FROM funcionarios WHERE id = ?', [deOutraEmpresa]);
            assert.equal(intacto.nome, 'Pessoa B');
        });

        it('recusa id da rota que não é um inteiro positivo', async () => {
            for (const id of ['abc', '0', '-3', '1.5', '99999999999']) {
                const { status, corpo } = await chamar('PUT', `/api/funcionarios/${id}`, { nome: 'a', email: 'a@b.co' });
                assert.equal(status, 400, id);
                assert.match(corpo.erro, /Identificador/);
            }
            assert.equal((await chamar('DELETE', '/api/funcionarios/abc')).status, 400);
        });

        it('devolve 409 quando o e-mail novo já pertence a outro login (corrida que o banco decide)', async () => {
            const id = await inserir('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['Pessoa Dup', 'dup.validacao@exemplo.invalid', empresaA]);
            await inserir('INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, funcionario_id) VALUES (?, ?, ?, ?, ?, ?)',
                ['Pessoa Dup', 'dup.validacao@exemplo.invalid', 'hash-ficticio', 'Colaborador', empresaA, id]);
            const { status, corpo } = await chamar('PUT', `/api/funcionarios/${id}`, { nome: 'Pessoa Dup', email: 'colab.validacao@exemplo.invalid' });
            assert.equal(status, 409);
            assert.match(corpo.erro, /e-mail/i);
            assert.deepEqual(corpo.detalhes.map((detalhe: any) => detalhe.campo), ['email']);
            const [[linha]] = await pool.query<RowDataPacket[]>('SELECT email FROM funcionarios WHERE id = ?', [id]);
            assert.equal(linha.email, 'dup.validacao@exemplo.invalid', 'a transação foi desfeita');
        });

        describe('listagem', () => {
            before(async () => {
                for (let i = 0; i < 5; i += 1) {
                    await inserir('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', [`Lista ${i}`, `lista.${i}.validacao@exemplo.invalid`, empresaB]);
                }
            });

            it('sem parâmetros devolve um array e o total no cabeçalho', async () => {
                const { status, corpo, cabecalhos } = await chamar('GET', '/api/funcionarios');
                assert.equal(status, 200);
                assert.ok(Array.isArray(corpo));
                assert.equal(Number(cabecalhos.get('x-total-count')), await contar('funcionarios'));
            });

            it('pagina de forma estável e sem misturar empresas', async () => {
                const total = await contar('funcionarios');
                const tokenB = tokens.adminB;
                const paginas = [];
                for (let pagina = 1; pagina <= 3; pagina += 1) {
                    const { corpo, cabecalhos } = await chamar('GET', `/api/funcionarios?limite=2&pagina=${pagina}`, undefined, { jwt: tokenB });
                    assert.ok(corpo.length <= 2);
                    assert.equal(Number(cabecalhos.get('x-total-count')), 6);
                    paginas.push(...corpo);
                }
                assert.equal(paginas.length, 6);
                assert.equal(new Set(paginas.map((p) => p.id)).size, 6, 'sem repetição entre páginas');
                assert.ok(paginas.every((p) => p.empresa_id === empresaB));
                assert.deepEqual(paginas.map((p) => p.id), [...paginas.map((p) => p.id)].sort((a, b) => a - b));
                assert.ok(total >= 1);
            });

            it('limita o número de itens por página', async () => {
                const { corpo } = await chamar('GET', '/api/funcionarios?limite=1');
                assert.equal(corpo.length, 1);
            });

            for (const consulta of ['limite=0', 'limite=1001', 'limite=abc', 'limite=-1', 'pagina=0', 'pagina=x', 'limite=10&limite=20']) {
                it(`recusa ?${consulta} com 400`, async () => {
                    const { status, corpo } = await chamar('GET', `/api/funcionarios?${consulta}`);
                    assert.equal(status, 400);
                    assert.match(corpo.erro, /limite|pagina/);
                });
            }
        });
    });

    describe('estrutura', () => {
        it('recusa sigla acima da coluna com 400', async () => {
            const antes = await contar('departamentos');
            const { status, corpo } = await chamar('POST', '/api/estrutura/departamentos', { nome: 'Departamento X', sigla: 'SIGLAMUITOLONGA' });
            assert.equal(status, 400);
            assert.match(corpo.erro, /Sigla deve ter no máximo 10/);
            assert.equal(await contar('departamentos'), antes);
        });

        it('cria, edita e lista departamento, com campos em branco virando nulos', async () => {
            const criado = await chamar('POST', '/api/estrutura/departamentos', { nome: 'Logística', sigla: 'LOG', descricao: '', gestor: '' });
            assert.equal(criado.status, 201);
            const { corpo } = await chamar('GET', '/api/estrutura/departamentos');
            const depto = corpo.find((d: any) => d.sigla === 'LOG');
            assert.equal(depto.descricao, null);

            const editado = await chamar('PUT', `/api/estrutura/departamentos/${depto.id}`, { nome: 'Logística Global', sigla: 'LOG', gestor: 'Gestora Ficticia' });
            assert.equal(editado.status, 200);
            assert.equal((await chamar('PUT', '/api/estrutura/departamentos/999999', { nome: 'X', sigla: 'X' })).status, 404);
        });

        it('recusa departamento sem nome e sem sigla, listando os dois campos', async () => {
            const { status, corpo } = await chamar('POST', '/api/estrutura/departamentos', {});
            assert.equal(status, 400);
            assert.deepEqual(corpo.detalhes.map((d: any) => d.campo), ['nome', 'sigla']);
        });

        for (const [nome, entrada, mensagem] of [
            ['salário negativo', { nome: 'Cargo X', salario_base: -1 }, /Salário base/],
            ['salário acima da coluna', { nome: 'Cargo X', salario_base: 1e9 }, /Salário base/],
            ['salário não numérico', { nome: 'Cargo X', salario_base: 'muito' }, /Salário base/],
            ['nível acima da coluna', { nome: 'Cargo X', nivel: 'n'.repeat(60) }, /Nível/],
            ['sem departamento', { nome: 'Cargo X', departamento_id: undefined }, /Departamento é obrigatório/],
        ] as [string, object, RegExp][]) {
            it(`recusa cargo com ${nome}`, async () => {
                const { status, corpo } = await chamar('POST', '/api/estrutura/cargos', { departamento_id: deptoA, ...entrada });
                assert.equal(status, 400);
                assert.match(corpo.erro, mensagem);
            });
        }

        it('cria cargo sem salário com 0, e responde 404 ao editar ou remover cargo que não existe', async () => {
            const criado = await chamar('POST', '/api/estrutura/cargos', { nome: 'Cargo Sem Salario', departamento_id: deptoA });
            assert.equal(criado.status, 201);
            const [[cargo]] = await pool.query<RowDataPacket[]>("SELECT salario_base FROM cargos WHERE nome = 'Cargo Sem Salario'");
            assert.equal(Number(cargo.salario_base), 0);
            assert.equal((await chamar('PUT', '/api/estrutura/cargos/999999', { nome: 'X', departamento_id: deptoA })).status, 404);
            assert.equal((await chamar('DELETE', '/api/estrutura/cargos/999999')).status, 404);
            assert.equal((await chamar('PUT', `/api/estrutura/cargos/${cargoB}`, { nome: 'Invasor', departamento_id: deptoA })).status, 404);
        });

        it('transforma a violação de chave estrangeira em 409, não em 500', async () => {
            const cargo = await inserir('INSERT INTO cargos (nome, departamento_id, empresa_id) VALUES (?, ?, ?)', ['Cargo Referenciado', deptoA, empresaA]);
            // Só colaboradores ativos impedem a remoção no controller: o inativo chega ao banco, que recusa.
            await inserir('INSERT INTO funcionarios (nome, email, status, cargo_id, empresa_id) VALUES (?, ?, ?, ?, ?)',
                ['Inativo Ficticio', 'inativo.validacao@exemplo.invalid', 'Inativo', cargo, empresaA]);
            const { status, corpo } = await chamar('DELETE', `/api/estrutura/cargos/${cargo}`);
            assert.equal(status, 409);
            assert.match(corpo.erro, /registros vinculados/);
        });

        it('pagina departamentos e cargos e informa o total', async () => {
            for (const recurso of ['departamentos', 'cargos']) {
                const { corpo, cabecalhos } = await chamar('GET', `/api/estrutura/${recurso}?limite=2`);
                assert.equal(corpo.length, 2);
                assert.equal(Number(cabecalhos.get('x-total-count')), await contar(recurso));
                assert.equal((await chamar('GET', `/api/estrutura/${recurso}?limite=2000`)).status, 400);
            }
        });
    });

    describe('folha', () => {
        it('pagina o processamento e informa o total de colaboradores ativos', async () => {
            await inserir('INSERT INTO funcionarios (nome, email, salario_base, empresa_id) VALUES (?, ?, ?, ?)', ['Folha Um', 'folha.1.validacao@exemplo.invalid', 2000, empresaA]);
            await inserir('INSERT INTO funcionarios (nome, email, salario_base, empresa_id) VALUES (?, ?, ?, ?)', ['Folha Dois', 'folha.2.validacao@exemplo.invalid', 3000, empresaA]);
            const total = (await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM funcionarios WHERE empresa_id = ? AND status = 'Ativo'", [empresaA]))[0][0].total;

            const { status, corpo, cabecalhos } = await chamar('GET', '/api/folha/processar?limite=1');
            assert.equal(status, 200);
            assert.equal(corpo.length, 1);
            assert.equal(Number(cabecalhos.get('x-total-count')), total);

            const completa = await chamar('GET', '/api/folha/processar');
            assert.equal(completa.corpo.length, total);
        });

        it('recusa paginação inválida com 400', async () => {
            assert.equal((await chamar('GET', '/api/folha/processar?limite=0')).status, 400);
            assert.equal((await chamar('GET', '/api/folha/processar?pagina=abc')).status, 400);
        });

        it('não exige parâmetros no holerite individual', async () => {
            assert.equal((await chamar('GET', '/api/folha/meu-holerite', undefined, { jwt: tokens.colaborador })).status, 200);
        });
    });

    describe('perfil', () => {
        const meusDados = (extra = {}) => ({ nome: 'Colaborador Ficticio', email: 'colab.validacao@exemplo.invalid', telefone: '(00) 90000-0000', ...extra });
        const comoColaborador = () => ({ jwt: tokens.colaborador });

        it('grava o avatar em formato e tamanho válidos, e remove com string vazia', async () => {
            const avatar = dataUrl('png', 2048);
            const ok = await chamar('PUT', '/api/perfil/meus-dados', meusDados({ avatar }), comoColaborador());
            assert.equal(ok.status, 200);
            const [[linha]] = await pool.query<RowDataPacket[]>('SELECT avatar FROM funcionarios WHERE id = ?', [funcionarioColaborador]);
            assert.equal(linha.avatar, avatar);

            const remover = await chamar('PUT', '/api/perfil/meus-dados', meusDados({ avatar: '' }), comoColaborador());
            assert.equal(remover.status, 200);
            const [[sem]] = await pool.query<RowDataPacket[]>('SELECT avatar FROM usuarios WHERE id = ?', [usuarioColaborador]);
            assert.equal(sem.avatar, null);
        });

        for (const [nome, avatar, mensagem] of [
            ['texto que não é imagem', 'nao-e-imagem', /data URL base64/],
            ['HTML disfarçado de imagem', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', /não suportado/],
            ['SVG', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', /não suportado/],
            ['assinatura que não bate com o tipo', dataUrl('gif', 64, 'png'), /não é uma imagem PNG válida/],
            ['imagem acima de 2 MB', dataUrl('jpeg', 2 * 1024 * 1024 + 1), /no máximo 2 MB/],
        ] as [string, string, RegExp][]) {
            it(`recusa avatar: ${nome}`, async () => {
                const { status, corpo } = await chamar('PUT', '/api/perfil/meus-dados', meusDados({ avatar }), comoColaborador());
                assert.equal(status, 400);
                assert.match(corpo.erro, mensagem);
                const [[linha]] = await pool.query<RowDataPacket[]>('SELECT avatar FROM usuarios WHERE id = ?', [usuarioColaborador]);
                assert.equal(linha.avatar, null, 'nada foi gravado');
            });
        }

        it('recusa nome e e-mail ausentes e telefone inválido', async () => {
            const { status, corpo } = await chamar('PUT', '/api/perfil/meus-dados', { telefone: 'abc' }, comoColaborador());
            assert.equal(status, 400);
            assert.deepEqual(corpo.detalhes.map((d: any) => d.campo), ['nome', 'email', 'telefone']);
        });

        it('altera a senha com política de cadastro e recusa senha nova fraca', async () => {
            const jwt = tokens.adminA;
            const fraca = await chamar('PUT', '/api/perfil/alterar-senha', { senhaAtual: 'senha-atual-ficticia', novaSenha: 'curta' }, { jwt });
            assert.equal(fraca.status, 400);
            assert.match(fraca.corpo.erro, /mínimo 8/);

            const errada = await chamar('PUT', '/api/perfil/alterar-senha', { senhaAtual: 'outra-senha', novaSenha: 'senha-nova-ficticia' }, { jwt });
            assert.equal(errada.status, 400);
            assert.match(errada.corpo.erro, /senha atual está incorreta/);

            const ok = await chamar('PUT', '/api/perfil/alterar-senha', { senhaAtual: 'senha-atual-ficticia', novaSenha: 'senha-nova-ficticia' }, { jwt });
            assert.equal(ok.status, 200);
        });
    });
});
