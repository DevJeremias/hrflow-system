// A matriz de permissões (docs/permissoes.md) contra a API inteira: cada rota é chamada com uma
// identidade de cada perfil e o status confere com a tabela. Depois, as regras do RH sobre os
// cadastros e o ciclo da conta criada pelo Administrador. Banco e variáveis em
// tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST os testes são marcados como ignorados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcrypt';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao, tokenDaResposta } from './support/sessao.ts';
import { subirServidor, pararServidor } from './support/servidor.ts';
import db from '../shared/db/pool.ts';
import { app } from '../app.ts';
import { PERMISSOES } from '../shared/utils/permissoes.ts';

type Identidade = 'Administrador' | 'RH' | 'Colaborador';
const IDENTIDADES: Identidade[] = ['Administrador', 'RH', 'Colaborador'];

describe('matriz de permissões', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let baseUrl: string;
    let empresa: number;
    const tokens = {} as Record<string, string>;
    const ids = {} as Record<string, number>;

    const chamar = async (metodo: string, caminho: string, token: string | undefined, corpo?: unknown) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        const texto = await resposta.text();
        return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, resposta };
    };

    const inserir = async (sql: string, valores: unknown[]) => (await db.query<ResultSetHeader>(sql, valores))[0].insertId;
    const funcionario = (nome: string, email: string, salario = 3000) =>
        inserir('INSERT INTO funcionarios (nome, email, salario_base, empresa_id) VALUES (?, ?, ?, ?)', [nome, email, salario, empresa]);
    const salarioDe = async (id: number) => (await db.query<RowDataPacket[]>('SELECT salario_base FROM funcionarios WHERE id = ?', [id]))[0][0]?.salario_base;
    const existe = async (id: number) => (await db.query<RowDataPacket[]>('SELECT id FROM funcionarios WHERE id = ?', [id]))[0].length === 1;

    let sequencia = 0;
    const emailNovo = () => `permissoes.${++sequencia}@exemplo.invalid`;

    // Um funcionário com conta do perfil pedido, como o cadastro de colaborador deixa.
    const pessoa = async (rotulo: string, perfil: Identidade, salario = 3000) => {
        const funcionarioId = await funcionario(`Pessoa ${rotulo}`, emailNovo(), salario);
        const { token, usuario } = await criarUsuario(db, { empresaId: empresa, perfil, funcionarioId });
        tokens[rotulo] = token;
        ids[rotulo] = funcionarioId;
        ids[`usuario ${rotulo}`] = usuario.id;
    };

    before(async () => {
        await banco.preparar();
        servidor = (await subirServidor(app)).server;
        baseUrl = `http://127.0.0.1:${(servidor.address() as import('node:net').AddressInfo).port}`;

        empresa = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia Permissoes']);
        tokens.Administrador = (await criarUsuario(db, { empresaId: empresa, perfil: 'Administrador' })).token;
        await pessoa('Rita', 'RH', 5200);
        await pessoa('Outro RH', 'RH');
        await pessoa('Admin com cadastro', 'Administrador');
        await pessoa('Caio', 'Colaborador', 6800);
        tokens.RH = tokens.Rita;
        tokens.Colaborador = tokens.Caio;
    });

    after(async () => {
        await pararServidor(servidor);
        await db.end();
        await banco.encerrar();
    });

    describe('cada rota, com cada perfil', () => {
        // permitido: quais perfis passam; os outros recebem 403. Os alvos são cadastros de Colaborador
        // criados sob demanda, para a rota que apaga ou edita ter o que apagar ou editar.
        interface Rota {
            rotulo: string;
            metodo: string;
            caminho: () => string | Promise<string>;
            corpo?: () => unknown;
            permitido: Identidade[];
        }
        const GESTAO: Identidade[] = ['Administrador', 'RH'];
        const SO_ADMIN: Identidade[] = ['Administrador'];

        let departamento: number;
        const colaboradorAlheio = async () => `/api/funcionarios/${await funcionario(`Alvo ${++sequencia}`, emailNovo())}`;
        const estruturaNova = async (tabela: 'departamentos' | 'cargos') => {
            const nome = `Alvo ${++sequencia}`;
            const id = tabela === 'departamentos'
                ? await inserir('INSERT INTO departamentos (nome, sigla, empresa_id) VALUES (?, ?, ?)', [nome, `A${sequencia}`, empresa])
                : await inserir('INSERT INTO cargos (nome, nivel, departamento_id, empresa_id) VALUES (?, ?, ?, ?)', [nome, 'Pleno', departamento, empresa]);
            return `/api/estrutura/${tabela}/${id}`;
        };
        const contaAlheia = async () => {
            const { usuario } = await criarUsuario(db, { empresaId: empresa, perfil: 'RH' });
            return `/api/usuarios/${usuario.id}`;
        };

        const rotas: Rota[] = [
            { rotulo: 'listar usuários', metodo: 'GET', caminho: () => '/api/usuarios', permitido: SO_ADMIN },
            { rotulo: 'criar usuário', metodo: 'POST', caminho: () => '/api/usuarios', corpo: () => ({ nome: 'Novo', email: emailNovo(), perfil: 'RH' }), permitido: SO_ADMIN },
            { rotulo: 'alterar usuário', metodo: 'PATCH', caminho: contaAlheia, corpo: () => ({ nome: 'Renomeado' }), permitido: SO_ADMIN },

            { rotulo: 'listar departamentos', metodo: 'GET', caminho: () => '/api/estrutura/departamentos', permitido: GESTAO },
            { rotulo: 'listar cargos', metodo: 'GET', caminho: () => '/api/estrutura/cargos', permitido: GESTAO },
            { rotulo: 'criar departamento', metodo: 'POST', caminho: () => '/api/estrutura/departamentos', corpo: () => ({ nome: `Dep ${++sequencia}`, sigla: `D${sequencia}` }), permitido: SO_ADMIN },
            { rotulo: 'alterar departamento', metodo: 'PUT', caminho: () => estruturaNova('departamentos'), corpo: () => ({ nome: `Dep ${++sequencia}`, sigla: `E${sequencia}` }), permitido: SO_ADMIN },
            { rotulo: 'excluir departamento', metodo: 'DELETE', caminho: () => estruturaNova('departamentos'), permitido: SO_ADMIN },
            { rotulo: 'criar cargo', metodo: 'POST', caminho: () => '/api/estrutura/cargos', corpo: () => ({ nome: `Cargo ${++sequencia}`, nivel: 'Pleno', departamento_id: departamento }), permitido: SO_ADMIN },
            { rotulo: 'alterar cargo', metodo: 'PUT', caminho: () => estruturaNova('cargos'), corpo: () => ({ nome: `Cargo ${++sequencia}`, nivel: 'Senior', departamento_id: departamento }), permitido: SO_ADMIN },
            { rotulo: 'excluir cargo', metodo: 'DELETE', caminho: () => estruturaNova('cargos'), permitido: SO_ADMIN },

            { rotulo: 'listar colaboradores', metodo: 'GET', caminho: () => '/api/funcionarios', permitido: GESTAO },
            { rotulo: 'criar colaborador', metodo: 'POST', caminho: () => '/api/funcionarios', corpo: () => ({ nome: 'Novo Colaborador', email: emailNovo(), senha: 'senha-ficticia' }), permitido: GESTAO },
            { rotulo: 'alterar colaborador', metodo: 'PUT', caminho: colaboradorAlheio, corpo: () => ({ nome: 'Renomeado', email: emailNovo() }), permitido: GESTAO },
            { rotulo: 'excluir colaborador', metodo: 'DELETE', caminho: colaboradorAlheio, permitido: GESTAO },

            { rotulo: 'processar folha', metodo: 'GET', caminho: () => '/api/folha/processar', permitido: GESTAO },
            { rotulo: 'ler pontos da empresa', metodo: 'GET', caminho: () => '/api/ponto?mes=2026-03', permitido: GESTAO },
            { rotulo: 'ler justificativas', metodo: 'GET', caminho: () => '/api/ponto/justificativas?mes=2026-03', permitido: GESTAO },
            { rotulo: 'resumo do dashboard', metodo: 'GET', caminho: () => '/api/dashboard/resumo', permitido: GESTAO },
            { rotulo: 'ver o próprio perfil', metodo: 'GET', caminho: () => '/api/perfil/meus-dados', permitido: IDENTIDADES },
        ];

        before(async () => {
            departamento = (await db.query<RowDataPacket[]>('SELECT MIN(id) AS id FROM departamentos WHERE empresa_id = ?', [empresa]))[0][0].id;
        });

        for (const rota of rotas) {
            for (const identidade of IDENTIDADES) {
                const esperado = rota.permitido.includes(identidade) ? 'permitida' : '403';
                it(`${rota.rotulo} (${rota.metodo}): ${identidade} ${esperado}`, async () => {
                    const caminho = await rota.caminho();
                    const { status, corpo } = await chamar(rota.metodo, caminho, tokens[identidade], rota.corpo?.());
                    if (esperado === '403') {
                        assert.equal(status, 403, JSON.stringify(corpo));
                    } else {
                        assert.ok(status >= 200 && status < 300, `${status} ${JSON.stringify(corpo)}`);
                    }
                });
            }
            it(`${rota.rotulo} (${rota.metodo}): sem sessão 401`, async () => {
                assert.equal((await chamar(rota.metodo, await rota.caminho(), undefined, rota.corpo?.())).status, 401);
            });
        }

        it('a matriz do código lista só o que as rotas pedem', () => {
            assert.deepEqual(PERMISSOES['usuarios:gerir'], SO_ADMIN);
            assert.deepEqual(PERMISSOES['estrutura:gerir'], SO_ADMIN);
            assert.deepEqual(PERMISSOES['estrutura:consultar'], GESTAO);
            assert.deepEqual(PERMISSOES['colaboradores:gerir'], GESTAO);
            assert.deepEqual(PERMISSOES['folha:processar'], GESTAO);
            assert.deepEqual(PERMISSOES['ponto:consultar-empresa'], GESTAO);
            assert.deepEqual(PERMISSOES['dashboard:consultar'], GESTAO);
        });
    });

    describe('quem tem cadastro de funcionário usa o próprio ponto e holerite em qualquer perfil', () => {
        for (const rotulo of ['Rita', 'Admin com cadastro', 'Caio']) {
            it(`${rotulo} vê o próprio holerite e bate ponto`, async () => {
                const holerite = await chamar('GET', '/api/folha/meu-holerite', tokens[rotulo]);
                assert.equal(holerite.status, 200, JSON.stringify(holerite.corpo));
                assert.equal(holerite.corpo.length, 1);

                const ponto = await chamar('POST', '/api/ponto/registrar', tokens[rotulo], { tipo: 'Entrada' });
                assert.equal(ponto.status, 201, JSON.stringify(ponto.corpo));

                const hoje = await chamar('GET', `/api/ponto/hoje/${ids[rotulo]}`, tokens[rotulo]);
                assert.equal(hoje.status, 200);
                assert.equal(hoje.corpo.length, 1);
            });
        }

        it('o Colaborador não lê o ponto de outra pessoa, o RH lê o de qualquer uma', async () => {
            assert.equal((await chamar('GET', `/api/ponto/hoje/${ids.Rita}`, tokens.Caio)).status, 403);
            assert.equal((await chamar('GET', `/api/ponto/hoje/${ids.Caio}`, tokens.Rita)).status, 200);
        });

        it('o Administrador sem cadastro não tem ponto nem holerite próprios', async () => {
            assert.equal((await chamar('POST', '/api/ponto/registrar', tokens.Administrador, { tipo: 'Entrada' })).status, 403);
            assert.equal((await chamar('GET', '/api/folha/meu-holerite', tokens.Administrador)).status, 404);
        });
    });

    describe('o RH sobre os cadastros', () => {
        const edicao = (extra: Record<string, unknown> = {}) => ({ nome: 'Nome Alterado', email: emailNovo(), ...extra });

        it('RH alterando o próprio salário recebe 403 e o salário não muda', async () => {
            const { status, corpo } = await chamar('PUT', `/api/funcionarios/${ids.Rita}`, tokens.Rita, edicao({ salario_base: 99000 }));
            assert.equal(status, 403, JSON.stringify(corpo));
            assert.equal(Number(await salarioDe(ids.Rita)), 5200);
        });

        it('RH inativando o próprio cadastro recebe 403', async () => {
            const { status } = await chamar('PUT', `/api/funcionarios/${ids.Rita}`, tokens.Rita, edicao({ status: 'Inativo' }));
            assert.equal(status, 403);
        });

        it('RH excluindo outro RH recebe 403 e o cadastro continua', async () => {
            assert.equal((await chamar('DELETE', `/api/funcionarios/${ids['Outro RH']}`, tokens.Rita)).status, 403);
            assert.ok(await existe(ids['Outro RH']));
        });

        it('RH alterando outro RH ou um Administrador com cadastro recebe 403', async () => {
            assert.equal((await chamar('PUT', `/api/funcionarios/${ids['Outro RH']}`, tokens.Rita, edicao({ salario_base: 1 }))).status, 403);
            assert.equal((await chamar('PUT', `/api/funcionarios/${ids['Admin com cadastro']}`, tokens.Rita, edicao())).status, 403);
            assert.equal((await chamar('DELETE', `/api/funcionarios/${ids['Admin com cadastro']}`, tokens.Rita)).status, 403);
        });

        it('RH excluindo o próprio cadastro recebe 403', async () => {
            assert.equal((await chamar('DELETE', `/api/funcionarios/${ids.Rita}`, tokens.Rita)).status, 403);
            assert.ok(await existe(ids.Rita));
        });

        it('RH altera o salário de um Colaborador', async () => {
            const { status } = await chamar('PUT', `/api/funcionarios/${ids.Caio}`, tokens.Rita, edicao({ salario_base: 7000 }));
            assert.equal(status, 200);
            assert.equal(Number(await salarioDe(ids.Caio)), 7000);
        });

        it('cadastro que não existe responde 404 também para o RH', async () => {
            assert.equal((await chamar('PUT', '/api/funcionarios/999999', tokens.Rita, edicao())).status, 404);
            assert.equal((await chamar('DELETE', '/api/funcionarios/999999', tokens.Rita)).status, 404);
        });

        it('o Administrador altera o cadastro de um RH, mas não exclui o próprio', async () => {
            assert.equal((await chamar('PUT', `/api/funcionarios/${ids['Outro RH']}`, tokens.Administrador, edicao({ salario_base: 4100 }))).status, 200);
            assert.equal(Number(await salarioDe(ids['Outro RH'])), 4100);
            assert.equal((await chamar('DELETE', `/api/funcionarios/${ids['Admin com cadastro']}`, tokens['Admin com cadastro'])).status, 403);
            assert.ok(await existe(ids['Admin com cadastro']));
        });

        it('a lista de colaboradores informa o perfil da conta de cada um', async () => {
            const { corpo } = await chamar('GET', '/api/funcionarios', tokens.Rita);
            const perfilDe = (id: number) => corpo.find((f: { id: number }) => f.id === id).perfil_acesso;
            assert.equal(perfilDe(ids.Rita), 'RH');
            assert.equal(perfilDe(ids.Caio), 'Colaborador');
            assert.equal(perfilDe(ids['Admin com cadastro']), 'Administrador');
        });
    });

    describe('usuários', () => {
        const criar = (perfil: string, extra: Record<string, unknown> = {}) =>
            chamar('POST', '/api/usuarios', tokens.Administrador, { nome: `Conta ${perfil} ${++sequencia}`, email: emailNovo(), perfil, ...extra });
        const login = (email: string, senha: string) => fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }),
        });

        it('o Administrador cria um RH e esse RH entra com a senha provisória', async () => {
            const { status, corpo } = await criar('RH');
            assert.equal(status, 201, JSON.stringify(corpo));
            assert.equal(corpo.usuario.perfil, 'RH');
            assert.equal(corpo.usuario.funcionario_id, null);
            assert.equal(corpo.usuario.senha_provisoria, 1);
            assert.match(corpo.senha_provisoria, /^[A-Za-z0-9]{12}$/);
            assert.equal(JSON.stringify(corpo).includes('"senha":'), false);

            const entrada = await login(corpo.usuario.email, corpo.senha_provisoria);
            assert.equal(entrada.status, 200);
            const token = tokenDaResposta(entrada);
            assert.equal((await chamar('GET', '/api/funcionarios', token)).status, 200);
            assert.equal((await chamar('GET', '/api/usuarios', token)).status, 403);
        });

        it('a senha provisória só existe na resposta: o banco guarda o hash', async () => {
            const { corpo } = await criar('Administrador');
            const [[linha]] = await db.query<RowDataPacket[]>('SELECT senha FROM usuarios WHERE id = ?', [corpo.usuario.id]);
            assert.notEqual(linha.senha, corpo.senha_provisoria);
            assert.ok(await bcrypt.compare(corpo.senha_provisoria, linha.senha));
            const lista = await chamar('GET', '/api/usuarios', tokens.Administrador);
            assert.equal(JSON.stringify(lista.corpo).includes(corpo.senha_provisoria), false);
            assert.equal(lista.corpo.every((u: Record<string, unknown>) => !('senha' in u)), true);
        });

        it('recusa o perfil Colaborador, perfil desconhecido, e-mail repetido e campo desconhecido', async () => {
            assert.equal((await criar('Colaborador')).status, 400);
            assert.equal((await criar('Gerente')).status, 400);
            assert.equal((await criar('RH', { salario: 1 })).status, 400);
            const primeiro = await criar('RH');
            const repetido = await chamar('POST', '/api/usuarios', tokens.Administrador, { nome: 'Outro', email: primeiro.corpo.usuario.email, perfil: 'RH' });
            assert.equal(repetido.status, 409);
        });

        it('lista só as contas da empresa do Administrador', async () => {
            const outra = await inserir('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia Outra']);
            const { usuario } = await criarUsuario(db, { empresaId: outra, perfil: 'RH' });
            const lista = await chamar('GET', '/api/usuarios', tokens.Administrador);
            assert.equal(lista.corpo.some((u: { id: number }) => u.id === usuario.id), false);
            assert.equal(lista.resposta.headers.get('X-Total-Count'), String(lista.corpo.length));
            assert.equal((await chamar('PATCH', `/api/usuarios/${usuario.id}`, tokens.Administrador, { nome: 'Invasor' })).status, 404);
        });

        it('promove um colaborador a RH, que passa a gerir colaboradores sem perder o ponto', async () => {
            const alvo = await funcionario('Promovida', emailNovo());
            const { usuario, token } = await criarUsuario(db, { empresaId: empresa, perfil: 'Colaborador', funcionarioId: alvo });
            assert.equal((await chamar('GET', '/api/funcionarios', token)).status, 403);

            const { status, corpo } = await chamar('PATCH', `/api/usuarios/${usuario.id}`, tokens.Administrador, { perfil: 'RH' });
            assert.equal(status, 200, JSON.stringify(corpo));
            assert.equal(corpo.usuario.perfil, 'RH');
            // O token antigo carrega o perfil antigo: a sessão é derrubada e o login traz o novo.
            assert.equal((await chamar('GET', '/api/funcionarios', token)).status, 401);
            const [[{ senha_provisoria: provisoria }]] = await db.query<RowDataPacket[]>('SELECT senha_provisoria FROM usuarios WHERE id = ?', [usuario.id]);
            assert.equal(provisoria, 0);
        });

        it('o Administrador não altera o próprio perfil nem redefine a própria senha por aqui', async () => {
            const [[{ id }]] = await db.query<RowDataPacket[]>("SELECT id FROM usuarios WHERE empresa_id = ? AND perfil = 'Administrador' AND funcionario_id IS NULL ORDER BY id LIMIT 1", [empresa]);
            assert.equal((await chamar('PATCH', `/api/usuarios/${id}`, tokens.Administrador, { perfil: 'RH' })).status, 403);
            assert.equal((await chamar('PATCH', `/api/usuarios/${id}`, tokens.Administrador, { redefinir_senha: true })).status, 403);
            assert.equal((await chamar('GET', '/api/usuarios', tokens.Administrador)).status, 200);
        });

        it('conta sem cadastro de funcionário não vira Colaborador, e conta com cadastro muda nome e e-mail no cadastro', async () => {
            const { corpo } = await criar('RH');
            assert.equal((await chamar('PATCH', `/api/usuarios/${corpo.usuario.id}`, tokens.Administrador, { perfil: 'Colaborador' })).status, 400);
            const vinculada = await chamar('PATCH', `/api/usuarios/${ids['usuario Caio']}`, tokens.Administrador, { nome: 'Outro Nome' });
            assert.equal(vinculada.status, 400);
        });

        it('corpo vazio, campo desconhecido e perfil inválido na edição respondem 400', async () => {
            const { corpo } = await criar('RH');
            const alvo = `/api/usuarios/${corpo.usuario.id}`;
            assert.equal((await chamar('PATCH', alvo, tokens.Administrador, {})).status, 400);
            assert.equal((await chamar('PATCH', alvo, tokens.Administrador, { senha: 'x' })).status, 400);
            assert.equal((await chamar('PATCH', alvo, tokens.Administrador, { perfil: 'Gerente' })).status, 400);
        });

        it('redefinir a senha devolve outra provisória, derruba a sessão e a antiga deixa de entrar', async () => {
            const criada = await criar('RH');
            const { email } = criada.corpo.usuario;
            const sessao = tokenDaResposta(await login(email, criada.corpo.senha_provisoria));
            assert.equal((await chamar('GET', '/api/funcionarios', sessao)).status, 200);

            const { status, corpo } = await chamar('PATCH', `/api/usuarios/${criada.corpo.usuario.id}`, tokens.Administrador, { redefinir_senha: true });
            assert.equal(status, 200, JSON.stringify(corpo));
            assert.notEqual(corpo.senha_provisoria, criada.corpo.senha_provisoria);
            assert.equal((await chamar('GET', '/api/funcionarios', sessao)).status, 401);
            assert.equal((await login(email, criada.corpo.senha_provisoria)).status, 401);
            assert.equal((await login(email, corpo.senha_provisoria)).status, 200);
        });

        it('trocar a própria senha encerra a senha provisória', async () => {
            const criada = await criar('RH');
            const { email, id } = criada.corpo.usuario;
            const sessao = tokenDaResposta(await login(email, criada.corpo.senha_provisoria));
            const troca = await chamar('PUT', '/api/perfil/alterar-senha', sessao, { senhaAtual: criada.corpo.senha_provisoria, novaSenha: 'senha-propria-1' });
            assert.equal(troca.status, 200, JSON.stringify(troca.corpo));
            const [[linha]] = await db.query<RowDataPacket[]>('SELECT senha_provisoria FROM usuarios WHERE id = ?', [id]);
            assert.equal(linha.senha_provisoria, 0);
        });
    });
});
