// B-22: a trilha de auditoria. Cada ação que muda dados ou acesso grava quem fez, o quê, quando e de onde,
// com o valor anterior e o novo, na mesma transação da mudança; o RH lê a trilha da própria empresa em
// GET /api/auditoria. Contra o app inteiro e um MySQL migrado (tests/support/bancoDeTeste.ts); sem
// HRFLOW_TEST_DB_HOST os testes são marcados como ignorados, nunca como aprovados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcrypt';
import type { RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarCliente } from './support/cliente.ts';
import { criarColaborador, criarEmpresa } from './support/empresas.ts';
import { criarUsuario } from './support/sessao.ts';
import { LIMITES_AUTH_FOLGADOS, pararServidor, subirServidor } from './support/servidor.ts';
import db from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import { diferencas } from '../shared/utils/auditar.ts';

describe('trilha de auditoria (B-22)', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let chamar: ReturnType<typeof criarCliente>;
    let empresaA: number;
    let empresaB: number;
    let admin: string;
    let adminId: number;
    let rh: string;
    let adminB: string;
    let colaborador: { funcionarioId: number; token: string; usuario: RowDataPacket };
    let sequencia = 0;

    const trilha = async (consulta: string, token = admin) => {
        const { status, corpo } = await chamar('GET', `/api/auditoria${consulta}`, token);
        assert.equal(status, 200, JSON.stringify(corpo));
        return corpo as Array<{ id: number; acao: string; entidade: string; entidade_id: number | null; funcionario_id: number | null; usuario_id: number | null; usuario_nome: string | null; perfil: string | null; ip: string | null; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null; criado_em: string }>;
    };
    const acoesDe = async (consulta: string, token = admin) => (await trilha(consulta, token)).map((linha) => linha.acao);
    const novoEmail = () => `auditoria.${process.pid}.${++sequencia}@exemplo.invalid`;

    // Colaborador criado pela API, como o RH faria.
    const cadastrar = async (extra: Record<string, unknown> = {}) => {
        const email = novoEmail();
        const resposta = await chamar('POST', '/api/funcionarios', admin, { nome: `Pessoa Ficticia ${sequencia}`, email, senha: 'senha-ficticia-1', salario_base: 3000, ...extra });
        assert.equal(resposta.status, 201, JSON.stringify(resposta.corpo));
        const [[{ id }]] = await db.query<RowDataPacket[]>('SELECT id FROM funcionarios WHERE email = ?', [email]);
        return { id: id as number, email };
    };

    before(async () => {
        await banco.preparar();
        const app = criarApp({ limitesAuth: LIMITES_AUTH_FOLGADOS });
        const { server, baseUrl } = await subirServidor(app);
        servidor = server;
        chamar = criarCliente(baseUrl);
        assert.ok((server.address() as AddressInfo).port);

        empresaA = (await criarEmpresa(db)).empresaId;
        empresaB = (await criarEmpresa(db)).empresaId;
        const contaAdmin = await criarUsuario(db, { empresaId: empresaA, perfil: 'Administrador' });
        admin = contaAdmin.token;
        adminId = contaAdmin.usuario.id;
        adminB = (await criarUsuario(db, { empresaId: empresaB, perfil: 'Administrador' })).token;
        rh = (await criarUsuario(db, { empresaId: empresaA, perfil: 'RH' })).token;
        colaborador = await criarColaborador(db, empresaA, { nome: 'Caio Colaborador', salario: 4000 });
    });

    after(async () => {
        await pararServidor(servidor);
        await db.end();
        await banco.encerrar();
    });

    describe('salário', () => {
        it('alterar o salário grava uma linha com o valor anterior e o novo, de quem alterou, quando e de onde', async () => {
            const { id, email } = await cadastrar();
            const antes = Date.now();
            const edicao = await chamar('PATCH', `/api/funcionarios/${id}`, admin, { nome: 'Pessoa Ficticia Editada', email, salario_base: 7250.5 });
            assert.equal(edicao.status, 200, JSON.stringify(edicao.corpo));

            const linhas = await trilha(`?entidade=funcionario&id=${id}&acao=funcionario.salario_alterado`);
            assert.equal(linhas.length, 1);
            const [linha] = linhas;
            assert.deepEqual(linha.antes, { salario_base: 3000 });
            assert.deepEqual(linha.depois, { salario_base: 7250.5 });
            assert.equal(linha.usuario_id, adminId);
            assert.equal(linha.perfil, 'Administrador');
            assert.equal(linha.entidade, 'funcionario');
            assert.equal(linha.entidade_id, id);
            assert.equal(linha.ip, '127.0.0.1');
            assert.ok(Date.parse(linha.criado_em) >= antes - 2000 && Date.parse(linha.criado_em) <= Date.now() + 2000);
        });

        it('editar sem mexer no salário não gera linha de salário, e o resto da edição vira "funcionario.editado" com só o que mudou', async () => {
            const { id, email } = await cadastrar();
            await chamar('PATCH', `/api/funcionarios/${id}`, admin, { nome: 'Nome Novo', email, salario_base: 3000, telefone: '(00) 91111-1111' });
            const acoes = await acoesDe(`?entidade=funcionario&id=${id}`);
            assert.ok(!acoes.includes('funcionario.salario_alterado'));
            const [editado] = (await trilha(`?entidade=funcionario&id=${id}&acao=funcionario.editado`));
            assert.deepEqual(editado.antes, { nome: `Pessoa Ficticia ${sequencia}`, telefone: null });
            assert.deepEqual(editado.depois, { nome: 'Nome Novo', telefone: '(00) 91111-1111' });
        });

        it('mudar o cargo grava os nomes do cargo de antes e de depois', async () => {
            const { id, email } = await cadastrar();
            const [cargos] = await db.query<RowDataPacket[]>('SELECT id, nome FROM cargos WHERE empresa_id = ? ORDER BY id LIMIT 2', [empresaA]);
            await chamar('PATCH', `/api/funcionarios/${id}`, admin, { nome: 'X', email, cargo_id: cargos[0].id });
            await chamar('PATCH', `/api/funcionarios/${id}`, admin, { nome: 'X', email, cargo_id: cargos[1].id });
            const [segunda, primeira] = await trilha(`?entidade=funcionario&id=${id}&acao=funcionario.editado`);
            assert.deepEqual(primeira.depois, { nome: 'X', cargo_id: cargos[0].id, cargo: cargos[0].nome });
            assert.deepEqual(segunda.antes, { cargo_id: cargos[0].id, cargo: cargos[0].nome });
            assert.deepEqual(segunda.depois, { cargo_id: cargos[1].id, cargo: cargos[1].nome });
        });
    });

    describe('colaborador', () => {
        it('criar, desligar, reativar, redefinir a senha e excluir entram na trilha; a senha não', async () => {
            const { id } = await cadastrar();
            const desligamento = { status: 'Inativo', data_desligamento: '2026-01-10', motivo_desligamento: 'Pedido de demissão' };
            assert.equal((await chamar('PATCH', `/api/funcionarios/${id}/status`, admin, desligamento)).status, 200);
            assert.equal((await chamar('PATCH', `/api/funcionarios/${id}/status`, admin, { status: 'Ativo' })).status, 200);
            const senha = await chamar('POST', `/api/funcionarios/${id}/redefinir-senha`, admin);
            assert.equal(senha.status, 200);

            const linhas = await trilha(`?entidade=funcionario&id=${id}`);
            assert.deepEqual(linhas.map((l) => l.acao).reverse(), ['funcionario.criado', 'funcionario.desligado', 'funcionario.reativado', 'funcionario.senha_redefinida']);
            const desligado = linhas.find((l) => l.acao === 'funcionario.desligado')!;
            assert.deepEqual(desligado.antes, { status: 'Ativo', data_desligamento: null, motivo_desligamento: null });
            assert.deepEqual(desligado.depois, desligamento);
            assert.ok(!JSON.stringify(linhas).includes(senha.corpo.senhaProvisoria), 'a senha provisória nunca entra na trilha');

            const novo = await cadastrar();
            assert.equal((await chamar('DELETE', `/api/funcionarios/${novo.id}`, admin)).status, 200);
            const excluido = (await trilha('?entidade=funcionario&acao=funcionario.excluido')).find((l) => l.entidade_id === novo.id)!;
            assert.equal(excluido.antes?.email, novo.email);
        });

        it('uma edição recusada não deixa linha na trilha (a auditoria confirma ou desfaz junto com a mudança)', async () => {
            const { id, email } = await cadastrar();
            const antes = (await trilha(`?entidade=funcionario&id=${id}`)).length;
            const recusada = await chamar('PATCH', `/api/funcionarios/${id}`, admin, { nome: 'Y', email, cargo_id: 99999999 });
            assert.equal(recusada.status, 400);
            assert.equal((await trilha(`?entidade=funcionario&id=${id}`)).length, antes);
        });
    });

    describe('acessos', () => {
        it('login que dá certo e login que falha entram na trilha do colaborador, com o motivo e o endereço', async () => {
            const senhaHash = await bcrypt.hash('senha-ficticia-1', 4);
            const conta = await criarUsuario(db, { empresaId: empresaA, perfil: 'Colaborador', funcionarioId: colaborador.funcionarioId, senhaHash });
            // criarUsuario usa um e-mail próprio; o colaborador de teste já tem conta, então a nova só serve para entrar.
            const ok = await chamar('POST', '/api/auth/login', null, { email: conta.usuario.email, senha: 'senha-ficticia-1' });
            assert.equal(ok.status, 200);
            const falha = await chamar('POST', '/api/auth/login', null, { email: conta.usuario.email, senha: 'senha-errada-1' });
            assert.equal(falha.status, 401);

            const linhas = await trilha(`?entidade=funcionario&id=${colaborador.funcionarioId}&acao=login`);
            const sucesso = linhas.find((l) => l.acao === 'login.sucesso')!;
            const recusado = linhas.find((l) => l.acao === 'login.falha')!;
            assert.equal(sucesso.usuario_id, conta.usuario.id);
            assert.equal(sucesso.ip, '127.0.0.1');
            assert.deepEqual(recusado.depois, { motivo: 'senha_incorreta' });
            assert.equal(recusado.usuario_id, conta.usuario.id);
            assert.ok(!JSON.stringify(linhas).includes('senha-errada-1'), 'a senha digitada nunca entra na trilha');
        });

        it('login com e-mail desconhecido grava a falha sem empresa, e nenhuma empresa a enxerga', async () => {
            const email = `desconhecido.${process.pid}@exemplo.invalid`;
            assert.equal((await chamar('POST', '/api/auth/login', null, { email, senha: 'senha-ficticia-1' })).status, 401);
            const [linhas] = await db.query<RowDataPacket[]>("SELECT empresa_id, usuario_id, depois FROM auditoria WHERE acao = 'login.falha' AND empresa_id IS NULL");
            assert.ok(linhas.length >= 1);
            assert.deepEqual(linhas[0].depois, { motivo: 'conta_inexistente' });
            assert.ok(!JSON.stringify(linhas).includes(email), 'o e-mail digitado por quem não tem conta não é guardado');
            for (const token of [admin, adminB]) {
                assert.ok(!(await trilha('?acao=login.falha', token)).some((l) => l.usuario_id === null));
            }
        });

        it('o colaborador desligado que tenta entrar é registrado como acesso desativado', async () => {
            const { id } = await cadastrar();
            await chamar('PATCH', `/api/funcionarios/${id}/status`, admin, { status: 'Inativo', data_desligamento: '2026-01-10', motivo_desligamento: 'Fim' });
            const [[{ email }]] = await db.query<RowDataPacket[]>('SELECT email FROM usuarios WHERE funcionario_id = ?', [id]);
            await db.query('UPDATE usuarios SET senha = ? WHERE funcionario_id = ?', [await bcrypt.hash('senha-ficticia-1', 4), id]);
            assert.equal((await chamar('POST', '/api/auth/login', null, { email, senha: 'senha-ficticia-1' })).status, 403);
            const falha = (await trilha(`?entidade=funcionario&id=${id}&acao=login.falha`))[0];
            assert.deepEqual(falha.depois, { motivo: 'acesso_desativado' });
        });

        it('trocar a própria senha entra na trilha, sem a senha', async () => {
            const hash = await bcrypt.hash('senha-ficticia-1', 4);
            const conta = await criarUsuario(db, { empresaId: empresaA, perfil: 'RH', senhaHash: hash });
            const sessao = await chamar('POST', '/api/auth/login', null, { email: conta.usuario.email, senha: 'senha-ficticia-1' });
            const troca = await chamar('PUT', '/api/perfil/alterar-senha', sessao.token, { senhaAtual: 'senha-ficticia-1', novaSenha: 'senha-nova-ficticia-2' });
            assert.equal(troca.status, 200);
            const linha = (await trilha('?entidade=usuario&acao=senha.alterada')).find((l) => l.entidade_id === conta.usuario.id)!;
            assert.equal(linha.usuario_id, conta.usuario.id);
            assert.ok(!JSON.stringify(linha).includes('senha-nova-ficticia-2'));
        });

        it('criar e alterar contas de acesso entra na trilha', async () => {
            const criada = await chamar('POST', '/api/usuarios', admin, { nome: 'RH Novo', email: novoEmail(), perfil: 'RH' });
            assert.equal(criada.status, 201);
            const id = criada.corpo.usuario.id;
            assert.equal((await chamar('PATCH', `/api/usuarios/${id}`, admin, { perfil: 'Administrador', redefinir_senha: true })).status, 200);
            const linhas = await trilha(`?entidade=usuario&id=${id}`);
            assert.deepEqual(linhas.map((l) => l.acao).reverse(), ['usuario.criado', 'usuario.editado', 'usuario.senha_redefinida']);
            assert.deepEqual(linhas.find((l) => l.acao === 'usuario.editado')!.antes, { perfil: 'RH' });
            assert.deepEqual(linhas.find((l) => l.acao === 'usuario.editado')!.depois, { perfil: 'Administrador' });
            assert.ok(!JSON.stringify(linhas).includes(criada.corpo.senha_provisoria));
        });
    });

    describe('folha e ponto', () => {
        it('processar e fechar a folha entram na trilha da folha, com a competência', async () => {
            assert.equal((await chamar('POST', '/api/folha/competencias/2026-09/processar', admin)).status, 201);
            assert.equal((await chamar('POST', '/api/folha/competencias/2026-09/fechar', admin)).status, 200);
            const linhas = await trilha('?entidade=folha');
            const acoes = linhas.map((l) => l.acao);
            assert.ok(acoes.includes('folha.processada') && acoes.includes('folha.fechada'));
            const processada = linhas.find((l) => l.acao === 'folha.processada')!;
            assert.equal(processada.depois?.competencia, '2026-09');
            assert.equal(typeof processada.depois?.colaboradores, 'number');
            assert.equal(linhas.find((l) => l.acao === 'folha.fechada')!.depois?.competencia, '2026-09');
        });

        it('enviar e decidir a justificativa entram na trilha do colaborador, com o status de antes e de depois', async () => {
            const enviada = await chamar('PUT', '/api/ponto/justificativa/2026-03-10', colaborador.token, { texto: 'Consulta médica.' });
            assert.equal(enviada.status, 200);
            const [[{ id }]] = await db.query<RowDataPacket[]>('SELECT id FROM justificativas_ponto WHERE funcionario_id = ?', [colaborador.funcionarioId]);
            const decisao = await chamar('PATCH', `/api/ponto/justificativas/${id}`, admin, { status: 'aprovada', resposta: 'Ok.' });
            assert.equal(decisao.status, 200, JSON.stringify(decisao.corpo));

            const linhas = await trilha(`?entidade=funcionario&id=${colaborador.funcionarioId}&acao=justificativa`);
            assert.deepEqual(linhas.map((l) => l.acao).reverse(), ['justificativa.enviada', 'justificativa.decidida']);
            const decidida = linhas[0];
            assert.deepEqual(decidida.antes, { status: 'pendente', resposta: null });
            assert.deepEqual(decidida.depois, { data: '2026-03-10', status: 'aprovada', resposta: 'Ok.' });
            assert.equal(decidida.usuario_id, adminId);
            // A trilha da própria justificativa responde à entidade.
            assert.equal((await trilha(`?entidade=justificativa&id=${id}`)).length, 2);
        });
    });

    describe('leitura', () => {
        it('cada empresa lê só a própria trilha', async () => {
            await cadastrar();
            const deA = await trilha('?entidade=funcionario');
            const deB = await trilha('?entidade=funcionario', adminB);
            assert.ok(deA.length > 0);
            assert.equal(deB.length, 0);
            const idDeA = deA[0].entidade_id;
            assert.equal((await trilha(`?entidade=funcionario&id=${idDeA}`, adminB)).length, 0, 'o id de outra empresa não mostra nada');
        });

        it('o RH lê a trilha; o Colaborador recebe 403; sem sessão 401', async () => {
            assert.ok((await trilha('', rh)).length > 0);
            assert.equal((await chamar('GET', '/api/auditoria', colaborador.token)).status, 403);
            assert.equal((await chamar('GET', '/api/auditoria')).status, 401);
        });

        it('a lista vem da mais recente para a mais antiga e informa o total no cabeçalho', async () => {
            const primeira = await chamar('GET', '/api/auditoria?limite=2', admin);
            assert.equal(primeira.corpo.length, 2);
            assert.ok(primeira.corpo[0].id > primeira.corpo[1].id);
            const [[{ total }]] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM auditoria WHERE empresa_id = ?', [empresaA]);
            assert.equal(primeira.resposta.headers.get('x-total-count'), String(total));
            const segunda = await chamar('GET', '/api/auditoria?limite=2&pagina=2', admin);
            assert.ok(segunda.corpo[0].id < primeira.corpo[1].id);
        });

        it('recusa id sem entidade e códigos fora do formato', async () => {
            for (const consulta of ['?id=3', '?entidade=Funcionario', '?entidade=funcionario&id=abc', "?acao=a'b", '?limite=0']) {
                assert.equal((await chamar('GET', `/api/auditoria${consulta}`, admin)).status, 400, consulta);
            }
        });

        it('a busca por ação trata % e _ como texto, não como curinga', async () => {
            assert.equal((await trilha('?acao=login.sucesso')).every((l) => l.acao === 'login.sucesso'), true);
            assert.equal((await chamar('GET', '/api/auditoria?acao=%25', admin)).status, 400);
        });
    });

    describe('diferencas', () => {
        it('lista só o que mudou e trata "5200.00" e 5200 como iguais', () => {
            assert.equal(diferencas({ a: '5200.00', b: 'x' }, { a: 5200, b: 'x' }, ['a', 'b']), null);
            assert.deepEqual(diferencas({ a: '5200.00', b: 'x', c: null }, { a: 5300, b: 'x', c: undefined }, ['a', 'b', 'c']), { antes: { a: '5200.00' }, depois: { a: 5300 } });
            assert.deepEqual(diferencas({ a: null }, { a: '' }, ['a']), { antes: { a: null }, depois: { a: '' } });
        });
    });

    it('a trilha guarda os autores mesmo depois de a conta ser apagada', async () => {
        const { id } = await cadastrar();
        const [[{ n }]] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM auditoria WHERE funcionario_id = ?', [id]);
        assert.equal((await chamar('DELETE', `/api/funcionarios/${id}`, admin)).status, 200);
        const [[{ depois }]] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS depois FROM auditoria WHERE funcionario_id = ?', [id]);
        assert.equal(depois, n + 1, 'as linhas continuam, mais a da exclusão');
    });
});
