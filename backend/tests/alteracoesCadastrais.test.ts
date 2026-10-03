// B-22: o colaborador edita sozinho só o telefone e a foto; nome, e-mail, endereço e dados bancários
// viram uma solicitação que o RH aprova (o do RH, o Administrador). Trocar o e-mail exige a senha atual e
// derruba as sessões abertas. Contra o app inteiro e um MySQL migrado (tests/support/bancoDeTeste.ts); sem
// HRFLOW_TEST_DB_HOST os testes são marcados como ignorados, nunca como aprovados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import bcrypt from 'bcrypt';
import type { RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarCliente } from './support/cliente.ts';
import { criarEmpresa, criarFuncionario } from './support/empresas.ts';
import { criarUsuario } from './support/sessao.ts';
import { LIMITES_AUTH_FOLGADOS, pararServidor, subirServidor } from './support/servidor.ts';
import db from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';

const SENHA = 'senha-ficticia-1';

interface Pessoa { token: string; usuarioId: number; funcionarioId: number | null; email: string; nome: string }

describe('alterações cadastrais por solicitação (B-22)', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let chamar: ReturnType<typeof criarCliente>;
    let empresa: number;
    let admin: Pessoa;
    let rita: Pessoa;
    let outroRh: Pessoa;
    let adminDeOutra: Pessoa;
    let hash: string;
    let sequencia = 0;

    // Uma conta com a senha conhecida, com ou sem cadastro de colaborador.
    const pessoa = async (perfil: 'Administrador' | 'RH' | 'Colaborador', { empresaId = empresa, comCadastro = perfil !== 'Administrador', nome = `Pessoa ${++sequencia}` } = {}): Promise<Pessoa> => {
        const funcionarioId = comCadastro ? await criarFuncionario(db, empresaId, { nome, salario: 3000 }) : null;
        const { usuario, token } = await criarUsuario(db, { empresaId, perfil, funcionarioId, senhaHash: hash });
        await db.query('UPDATE usuarios SET nome = ? WHERE id = ?', [nome, usuario.id]);
        if (funcionarioId) await db.query('UPDATE funcionarios SET email = ? WHERE id = ?', [usuario.email, funcionarioId]);
        return { token, usuarioId: usuario.id, funcionarioId, email: usuario.email, nome };
    };

    const cadastro = async (id: number) => (await db.query<RowDataPacket[]>('SELECT * FROM funcionarios WHERE id = ?', [id]))[0][0];
    const conta = async (id: number) => (await db.query<RowDataPacket[]>('SELECT * FROM usuarios WHERE id = ?', [id]))[0][0];
    const pendentes = async (usuarioId: number) => (await db.query<RowDataPacket[]>("SELECT * FROM solicitacoes_alteracao WHERE usuario_id = ? AND status = 'pendente'", [usuarioId]))[0];
    const pedir = (quem: Pessoa, corpo: object) => chamar('PUT', '/api/perfil/meus-dados', quem.token, corpo);
    const decidir = (quem: Pessoa, id: number, status: string, resposta?: string) => chamar('PATCH', `/api/solicitacoes-alteracao/${id}`, quem.token, { status, resposta });
    const emailNovo = () => `novo.${process.pid}.${++sequencia}@exemplo.invalid`;

    before(async () => {
        await banco.preparar();
        hash = await bcrypt.hash(SENHA, 4);
        const { server, baseUrl } = await subirServidor(criarApp({ limitesAuth: LIMITES_AUTH_FOLGADOS }));
        servidor = server;
        chamar = criarCliente(baseUrl);
        empresa = (await criarEmpresa(db)).empresaId;
        admin = await pessoa('Administrador');
        rita = await pessoa('RH', { nome: 'Rita RH' });
        outroRh = await pessoa('RH', { nome: 'Outro RH' });
        adminDeOutra = await pessoa('Administrador', { empresaId: (await criarEmpresa(db)).empresaId });
    });

    after(async () => {
        await pararServidor(servidor);
        await db.end();
        await banco.encerrar();
    });

    describe('o colaborador', () => {
        it('alterar o nome responde 403, cria a solicitação e não muda o nome', async () => {
            const caio = await pessoa('Colaborador', { nome: 'Caio Antigo' });
            const resposta = await pedir(caio, { nome: 'Caio Novo' });
            assert.equal(resposta.status, 403, JSON.stringify(resposta.corpo));
            assert.match(resposta.corpo.erro, /nome depende de aprovação/);
            assert.equal(resposta.corpo.solicitacao.status, 'pendente');
            assert.deepEqual(resposta.corpo.solicitacao.alteracoes, { nome: 'Caio Novo' });
            assert.deepEqual(resposta.corpo.solicitacao.anteriores, { nome: 'Caio Antigo' });

            assert.equal((await cadastro(caio.funcionarioId!)).nome, 'Caio Antigo');
            assert.equal((await conta(caio.usuarioId)).nome, 'Caio Antigo');
            assert.equal((await pendentes(caio.usuarioId)).length, 1);
        });

        it('telefone e foto ele grava direto', async () => {
            const caio = await pessoa('Colaborador');
            const resposta = await pedir(caio, { telefone: '(00) 93333-3333' });
            assert.equal(resposta.status, 200, JSON.stringify(resposta.corpo));
            assert.equal(resposta.corpo.sessaoEncerrada, false);
            assert.equal((await cadastro(caio.funcionarioId!)).telefone, '(00) 93333-3333');
            assert.equal((await pedir(caio, { telefone: '' })).status, 200);
            assert.equal((await cadastro(caio.funcionarioId!)).telefone, null);
        });

        it('enviar o que já é o valor atual junto com o telefone não é pedido de alteração', async () => {
            const caio = await pessoa('Colaborador', { nome: 'Caio Igual' });
            const resposta = await pedir(caio, { nome: 'Caio Igual', email: caio.email, endereco: null, telefone: '(00) 94444-4444' });
            assert.equal(resposta.status, 200, JSON.stringify(resposta.corpo));
            assert.equal((await pendentes(caio.usuarioId)).length, 0);
        });

        it('um campo protegido na mesma requisição que o telefone: 403 e nada é gravado, nem o telefone', async () => {
            const caio = await pessoa('Colaborador');
            const resposta = await pedir(caio, { nome: 'Outro Nome', telefone: '(00) 95555-5555' });
            assert.equal(resposta.status, 403);
            assert.equal((await cadastro(caio.funcionarioId!)).telefone, null);
        });

        it('trocar o e-mail pede a senha atual: sem ela ou com ela errada, 400 e nenhum pedido', async () => {
            const caio = await pessoa('Colaborador');
            const sem = await pedir(caio, { email: emailNovo() });
            assert.equal(sem.status, 400);
            assert.match(sem.corpo.erro, /senha atual/);
            const errada = await pedir(caio, { email: emailNovo(), senhaAtual: 'senha-errada-9' });
            assert.equal(errada.status, 400);
            assert.match(errada.corpo.erro, /senha atual está incorreta/);
            assert.equal((await pendentes(caio.usuarioId)).length, 0);
            assert.equal((await conta(caio.usuarioId)).email, caio.email);
        });

        it('trocar o e-mail com a senha certa cria o pedido; o e-mail só muda na aprovação, que derruba as sessões', async () => {
            const caio = await pessoa('Colaborador');
            const novo = emailNovo();
            const resposta = await pedir(caio, { email: novo, senhaAtual: SENHA });
            assert.equal(resposta.status, 403, JSON.stringify(resposta.corpo));
            assert.deepEqual(resposta.corpo.solicitacao.alteracoes, { email: novo });
            assert.ok(!JSON.stringify(resposta.corpo).includes(SENHA), 'a senha nunca volta nem é guardada');
            assert.equal((await conta(caio.usuarioId)).email, caio.email);

            const versaoAntes = (await conta(caio.usuarioId)).sessao_versao;
            const aprovada = await decidir(rita, resposta.corpo.solicitacao.id, 'aprovada');
            assert.equal(aprovada.status, 200, JSON.stringify(aprovada.corpo));
            const depois = await conta(caio.usuarioId);
            assert.equal(depois.email, novo);
            assert.equal(depois.sessao_versao, versaoAntes + 1);
            assert.equal((await cadastro(caio.funcionarioId!)).email, novo, 'o cadastro acompanha a conta');
            assert.equal((await chamar('GET', '/api/perfil/meus-dados', caio.token)).status, 401, 'a sessão antiga caiu');
        });

        it('um e-mail que outra conta já usa é recusado no pedido', async () => {
            const caio = await pessoa('Colaborador');
            const resposta = await pedir(caio, { email: rita.email, senhaAtual: SENHA });
            assert.equal(resposta.status, 400);
            assert.equal((await pendentes(caio.usuarioId)).length, 0);
        });

        it('endereço e dados bancários também dependem de aprovação, e a aprovação grava todos', async () => {
            const caio = await pessoa('Colaborador');
            const corpo = { endereco: 'Rua Ficticia, 10', banco: 'Banco Ficticio', agencia: '0001', conta: '12345-6', tipo_conta: 'Poupanca' };
            const resposta = await pedir(caio, corpo);
            assert.equal(resposta.status, 403);
            assert.deepEqual(resposta.corpo.solicitacao.alteracoes, corpo);
            assert.equal((await cadastro(caio.funcionarioId!)).banco, null);

            assert.equal((await decidir(rita, resposta.corpo.solicitacao.id, 'aprovada')).status, 200);
            const gravado = await cadastro(caio.funcionarioId!);
            assert.deepEqual({ endereco: gravado.endereco, banco: gravado.banco, agencia: gravado.agencia, conta: gravado.conta, tipo_conta: gravado.tipo_conta }, corpo);
            const perfil = await chamar('GET', '/api/perfil/meus-dados', caio.token);
            assert.equal(perfil.corpo.banco, 'Banco Ficticio');
        });

        it('um pedido novo cancela o pendente anterior', async () => {
            const caio = await pessoa('Colaborador');
            const primeiro = await pedir(caio, { nome: 'Primeiro Pedido' });
            const segundo = await pedir(caio, { nome: 'Segundo Pedido' });
            assert.notEqual(primeiro.corpo.solicitacao.id, segundo.corpo.solicitacao.id);
            const minhas = await chamar('GET', '/api/solicitacoes-alteracao/minhas', caio.token);
            assert.deepEqual(minhas.corpo.map((s: { status: string }) => s.status), ['pendente', 'cancelada']);
            assert.equal((await decidir(rita, primeiro.corpo.solicitacao.id, 'aprovada')).status, 409);
        });

        it('o pedido direto (POST) responde 201, recusa o que não muda nada e campos desconhecidos', async () => {
            const caio = await pessoa('Colaborador', { nome: 'Caio Direto' });
            const criado = await chamar('POST', '/api/solicitacoes-alteracao', caio.token, { nome: 'Caio Direto Novo' });
            assert.equal(criado.status, 201, JSON.stringify(criado.corpo));
            assert.equal(criado.corpo.solicitante.nome, 'Caio Direto');
            assert.equal((await chamar('POST', '/api/solicitacoes-alteracao', caio.token, { nome: 'Caio Direto' })).status, 400);
            assert.equal((await chamar('POST', '/api/solicitacoes-alteracao', caio.token, { salario_base: 9999 })).status, 400);
            assert.equal((await chamar('POST', '/api/solicitacoes-alteracao', caio.token, {})).status, 400);
        });

        it('o colaborador vê só os próprios pedidos e não lista nem decide os da empresa', async () => {
            const caio = await pessoa('Colaborador');
            const dora = await pessoa('Colaborador');
            await pedir(dora, { nome: 'Dora Nova' });
            assert.deepEqual((await chamar('GET', '/api/solicitacoes-alteracao/minhas', caio.token)).corpo, []);
            assert.equal((await chamar('GET', '/api/solicitacoes-alteracao', caio.token)).status, 403);
            const pedido = (await chamar('GET', '/api/solicitacoes-alteracao/minhas', dora.token)).corpo[0];
            assert.equal((await chamar('PATCH', `/api/solicitacoes-alteracao/${pedido.id}`, caio.token, { status: 'aprovada' })).status, 403);
        });
    });

    describe('quem decide', () => {
        it('o RH aprova o pedido do colaborador: o nome muda no cadastro e na conta, com a trilha de antes e depois', async () => {
            const caio = await pessoa('Colaborador', { nome: 'Caio Antes' });
            const pedido = (await pedir(caio, { nome: 'Caio Depois' })).corpo.solicitacao;

            const lista = await chamar('GET', '/api/solicitacoes-alteracao?status=pendente', rita.token);
            assert.equal(lista.status, 200);
            assert.ok(lista.corpo.some((s: { id: number }) => s.id === pedido.id));

            const aprovada = await decidir(rita, pedido.id, 'aprovada', 'Confirmado.');
            assert.equal(aprovada.status, 200, JSON.stringify(aprovada.corpo));
            assert.equal(aprovada.corpo.status, 'aprovada');
            assert.equal(aprovada.corpo.resposta, 'Confirmado.');
            assert.equal(aprovada.corpo.decidido_por, 'Rita RH');
            assert.equal((await cadastro(caio.funcionarioId!)).nome, 'Caio Depois');
            assert.equal((await conta(caio.usuarioId)).nome, 'Caio Depois');
            assert.equal((await conta(caio.usuarioId)).sessao_versao, 0, 'trocar só o nome não derruba a sessão');

            const [[linha]] = await db.query<RowDataPacket[]>(
                "SELECT usuario_id, antes, depois FROM auditoria WHERE acao = 'solicitacao.aprovada' AND entidade_id = ?", [pedido.id]
            );
            assert.equal(linha.usuario_id, rita.usuarioId);
            assert.deepEqual(linha.antes, { nome: 'Caio Antes' });
            assert.deepEqual(linha.depois, { nome: 'Caio Depois' });
        });

        it('recusar mantém tudo como está e guarda a resposta', async () => {
            const caio = await pessoa('Colaborador', { nome: 'Caio Fica' });
            const pedido = (await pedir(caio, { nome: 'Caio Sai' })).corpo.solicitacao;
            const recusada = await decidir(rita, pedido.id, 'recusada', 'Use o nome do documento.');
            assert.equal(recusada.status, 200);
            assert.equal(recusada.corpo.status, 'recusada');
            assert.equal((await cadastro(caio.funcionarioId!)).nome, 'Caio Fica');
            assert.equal((await decidir(rita, pedido.id, 'aprovada')).status, 409, 'o que já foi decidido não se decide de novo');
        });

        it('se o e-mail pedido foi tomado depois do pedido, aprovar dá 409 e o gestor recusa', async () => {
            const caio = await pessoa('Colaborador');
            const disputado = emailNovo();
            const pedido = (await pedir(caio, { email: disputado, senhaAtual: SENHA })).corpo.solicitacao;
            await db.query('UPDATE usuarios SET email = ? WHERE id = ?', [disputado, rita.usuarioId]);
            try {
                assert.equal((await decidir(admin, pedido.id, 'aprovada')).status, 409);
                assert.equal((await decidir(admin, pedido.id, 'recusada')).status, 200);
            } finally {
                await db.query('UPDATE usuarios SET email = ? WHERE id = ?', [rita.email, rita.usuarioId]);
            }
        });

        it('o RH não decide o próprio pedido nem o de outro RH: só o Administrador', async () => {
            const pedidoDaRita = (await pedir(rita, { nome: 'Rita Renomeada' })).corpo.solicitacao;
            assert.equal(pedidoDaRita.solicitante.perfil, 'RH');
            assert.equal((await decidir(rita, pedidoDaRita.id, 'aprovada')).status, 403, 'o próprio pedido');
            assert.equal((await decidir(outroRh, pedidoDaRita.id, 'aprovada')).status, 403, 'o pedido de outro RH');
            assert.equal((await cadastro(rita.funcionarioId!)).nome, 'Rita RH');

            assert.equal((await decidir(admin, pedidoDaRita.id, 'aprovada')).status, 200);
            assert.equal((await cadastro(rita.funcionarioId!)).nome, 'Rita Renomeada');
            await db.query('UPDATE funcionarios SET nome = ? WHERE id = ?', ['Rita RH', rita.funcionarioId]);
            await db.query('UPDATE usuarios SET nome = ? WHERE id = ?', ['Rita RH', rita.usuarioId]);
        });

        it('o RH lista só os pedidos de Colaboradores; o Administrador lista todos', async () => {
            const caio = await pessoa('Colaborador');
            await pedir(caio, { nome: 'Caio Lista' });
            await pedir(outroRh, { nome: 'Outro RH Lista' });
            const doRh = (await chamar('GET', '/api/solicitacoes-alteracao', rita.token)).corpo as Array<{ solicitante: { perfil: string } }>;
            const doAdmin = (await chamar('GET', '/api/solicitacoes-alteracao', admin.token)).corpo as Array<{ solicitante: { perfil: string } }>;
            assert.ok(doRh.length > 0 && doRh.every((s) => s.solicitante.perfil === 'Colaborador'));
            assert.ok(doAdmin.some((s) => s.solicitante.perfil === 'RH'));
            assert.ok(doAdmin.length > doRh.length);
        });

        it('um RH sem cadastro de colaborador pede nome e e-mail, mas não endereço nem banco', async () => {
            const semCadastro = await pessoa('RH', { comCadastro: false, nome: 'RH Sem Cadastro' });
            assert.equal((await pedir(semCadastro, { endereco: 'Rua X' })).status, 400);
            const pedido = await pedir(semCadastro, { nome: 'RH Sem Cadastro Novo' });
            assert.equal(pedido.status, 403);
            assert.equal((await decidir(rita, pedido.corpo.solicitacao.id, 'aprovada')).status, 403, 'o RH não decide pedido de RH');
            assert.equal((await decidir(admin, pedido.corpo.solicitacao.id, 'aprovada')).status, 200);
            assert.equal((await conta(semCadastro.usuarioId)).nome, 'RH Sem Cadastro Novo');
        });

        it('cada empresa decide e lista só os pedidos da própria empresa', async () => {
            const caio = await pessoa('Colaborador');
            const pedido = (await pedir(caio, { nome: 'Caio Isolado' })).corpo.solicitacao;
            assert.equal((await decidir(adminDeOutra, pedido.id, 'aprovada')).status, 404);
            const lista = await chamar('GET', '/api/solicitacoes-alteracao', adminDeOutra.token);
            assert.ok(!lista.corpo.some((s: { id: number }) => s.id === pedido.id));
        });

        it('recusa decisão inválida e id inexistente', async () => {
            assert.equal((await decidir(admin, 999999, 'aprovada')).status, 404);
            assert.equal((await chamar('PATCH', '/api/solicitacoes-alteracao/1', admin.token, { status: 'pendente' })).status, 400);
            assert.equal((await chamar('GET', '/api/solicitacoes-alteracao?status=qualquer', admin.token)).status, 400);
        });
    });

    describe('o Administrador', () => {
        it('altera o próprio nome direto, sem solicitação, e a trilha guarda o antes e o depois', async () => {
            const adm = await pessoa('Administrador', { nome: 'Admin Antes' });
            const resposta = await pedir(adm, { nome: 'Admin Depois' });
            assert.equal(resposta.status, 200, JSON.stringify(resposta.corpo));
            assert.equal((await conta(adm.usuarioId)).nome, 'Admin Depois');
            const [[linha]] = await db.query<RowDataPacket[]>("SELECT antes, depois FROM auditoria WHERE acao = 'perfil.atualizado' AND entidade_id = ?", [adm.usuarioId]);
            assert.deepEqual(linha.antes, { nome: 'Admin Antes' });
            assert.deepEqual(linha.depois, { nome: 'Admin Depois' });
        });

        it('trocar o e-mail exige a senha atual, incrementa a versão da sessão e encerra a sessão', async () => {
            const adm = await pessoa('Administrador');
            const novo = emailNovo();
            assert.equal((await pedir(adm, { email: novo })).status, 400);
            assert.equal((await pedir(adm, { email: novo, senhaAtual: 'errada-errada' })).status, 400);
            assert.equal((await conta(adm.usuarioId)).email, adm.email);

            const versao = (await conta(adm.usuarioId)).sessao_versao;
            const resposta = await pedir(adm, { email: novo, senhaAtual: SENHA });
            assert.equal(resposta.status, 200, JSON.stringify(resposta.corpo));
            assert.equal(resposta.corpo.sessaoEncerrada, true);
            assert.equal((await conta(adm.usuarioId)).email, novo);
            assert.equal((await conta(adm.usuarioId)).sessao_versao, versao + 1);
            assert.equal((await chamar('GET', '/api/perfil/meus-dados', adm.token)).status, 401);

            const login = await chamar('POST', '/api/auth/login', null, { email: novo, senha: SENHA });
            assert.equal(login.status, 200);
        });

        it('não pede solicitação: o POST responde 400 com a orientação', async () => {
            const resposta = await chamar('POST', '/api/solicitacoes-alteracao', admin.token, { nome: 'Qualquer' });
            assert.equal(resposta.status, 400);
            assert.match(resposta.corpo.erro, /diretamente/);
        });

        it('um e-mail de outra conta é recusado', async () => {
            const adm = await pessoa('Administrador');
            const resposta = await pedir(adm, { email: rita.email, senhaAtual: SENHA });
            assert.equal(resposta.status, 400);
            assert.match(resposta.corpo.erro, /já utilizado/);
        });
    });

    it('o RH que edita o e-mail de um colaborador pelo cadastro derruba as sessões dele', async () => {
        const caio = await pessoa('Colaborador');
        const versao = (await conta(caio.usuarioId)).sessao_versao;
        const edicao = await chamar('PUT', `/api/funcionarios/${caio.funcionarioId}`, rita.token, { nome: caio.nome, email: emailNovo() });
        assert.equal(edicao.status, 200, JSON.stringify(edicao.corpo));
        assert.equal((await conta(caio.usuarioId)).sessao_versao, versao + 1);
        assert.equal((await chamar('GET', '/api/perfil/meus-dados', caio.token)).status, 401);
    });

    it('a anonimização cancela o pedido pendente e apaga os valores pedidos', async () => {
        const caio = await pessoa('Colaborador');
        const pedido = (await pedir(caio, { nome: 'Nome Que Sera Apagado', endereco: 'Rua Ficticia' })).corpo.solicitacao;
        await db.query("UPDATE funcionarios SET status = 'Inativo', data_desligamento = '2026-01-10', motivo_desligamento = 'Fim' WHERE id = ?", [caio.funcionarioId]);
        assert.equal((await chamar('POST', `/api/funcionarios/${caio.funcionarioId}/anonimizar`, admin.token)).status, 200);
        const [[linha]] = await db.query<RowDataPacket[]>('SELECT status, alteracoes, anteriores FROM solicitacoes_alteracao WHERE id = ?', [pedido.id]);
        assert.deepEqual({ ...linha }, { status: 'cancelada', alteracoes: {}, anteriores: {} });
    });

});
