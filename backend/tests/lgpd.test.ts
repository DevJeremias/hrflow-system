// B-22: os direitos do titular. A empresa exporta os dados de um colaborador (GET /api/funcionarios/:id/exportar)
// e anonimiza o cadastro de quem já saiu (POST /api/funcionarios/:id/anonimizar, só o Administrador), mantendo
// as marcações com o id. Nenhuma coluna de funcionarios guarda a foto em base64, e a listagem não a traz.
// Contra o app inteiro e um MySQL migrado (tests/support/bancoDeTeste.ts); sem HRFLOW_TEST_DB_HOST os testes
// são marcados como ignorados, nunca como aprovados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import bcrypt from 'bcrypt';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarCliente } from './support/cliente.ts';
import { criarColaborador, criarEmpresa, criarFuncionario } from './support/empresas.ts';
import { imagemReal } from './support/imagens.ts';
import { criarUsuario } from './support/sessao.ts';
import { LIMITES_AUTH_FOLGADOS, pararServidor, subirServidor } from './support/servidor.ts';
import db from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';

const SENHA = 'senha-ficticia-1';
const CPF = '123.456.789-09';
const NOME = 'Teresa Titular Ficticia';
const ENDERECO = 'Rua dos Testes Ficticios, 42, Belém';
const BANCO = 'Banco Titular Ficticio';
const TELEFONE = '(91) 98888-7777';

describe('direitos do titular (B-22)', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let chamar: ReturnType<typeof criarCliente>;
    let empresa: number;
    let admin: { token: string; funcionarioId: number | null };
    let rh: string;
    let colaboradorAtivo: string;
    let adminDeOutra: string;
    let folhaFechada: number;
    let sequencia = 0;

    // Um colaborador completo: dados pessoais, foto, marcações com localização, justificativa, holerite
    // fechado, pedido de alteração pendente e trilha. Fica Inativo (desligado) ao final, pronto para anonimizar.
    const titular = async ({ desligar = true } = {}) => {
        const nome = `${NOME} ${++sequencia}`;
        const email = `titular.${process.pid}.${sequencia}@exemplo.invalid`;
        const cadastrado = await chamar('POST', '/api/funcionarios', admin.token, {
            nome, email, senha: SENHA, cpf: CPF, telefone: TELEFONE, data_nascimento: '1990-04-05', data_admissao: '2024-01-02', endereco: ENDERECO,
            banco: BANCO, agencia: '0001', conta: '98765-4', tipo_conta: 'Corrente', salario_base: 4500,
        });
        assert.equal(cadastrado.status, 201, JSON.stringify(cadastrado.corpo));
        const { id: funcionarioId, usuarioId } = await linha('SELECT f.id, u.id AS usuarioId FROM funcionarios f JOIN usuarios u ON u.funcionario_id = f.id WHERE f.email = ?', [email]) as { id: number; usuarioId: number };
        await db.query('UPDATE usuarios SET senha_provisoria = FALSE WHERE id = ?', [usuarioId]);
        const token = (await chamar('POST', '/api/auth/login', null, { email, senha: SENHA })).token as string;

        assert.equal((await chamar('PUT', '/api/perfil/meus-dados', token, { avatar: await imagemReal('png'), telefone: TELEFONE })).status, 200);
        await db.query(
            `INSERT INTO registro_pontos (funcionario_id, empresa_id, tipo_registro, latitude, longitude, data_hora_oficial)
             VALUES (?, ?, 'Entrada', -1.45502, -48.50240, '2026-09-10 11:00:00'), (?, ?, 'Saída', -1.45502, -48.50240, '2026-09-10 20:00:00')`,
            [funcionarioId, empresa, funcionarioId, empresa]
        );
        assert.equal((await chamar('PUT', '/api/ponto/justificativa/2026-09-11', token, { texto: 'Consulta médica do filho, atestado anexo.' })).status, 200);
        // O holerite fechado de setembro, gravado direto: processar e fechar a folha é assunto dos testes da folha.
        await db.query(
            `INSERT INTO folha_itens (folha_id, empresa_id, funcionario_id, nome, cargo, departamento, tipo_contrato, bruto, inss, liquido, encargos, rubricas)
             VALUES (?, ?, ?, ?, 'Analista', 'Financeiro', 'CLT', 4500, 400, 4100, 900, '[]')`,
            [folhaFechada, empresa, funcionarioId, nome]
        );
        assert.equal((await chamar('PUT', '/api/perfil/meus-dados', token, { nome: `${nome} Sobrenome Novo` })).status, 403);
        if (desligar) {
            const status = await chamar('PATCH', `/api/funcionarios/${funcionarioId}/status`, admin.token, { status: 'Inativo', data_desligamento: '2026-09-30', motivo_desligamento: 'Pedido de demissão por motivo de saúde' });
            assert.equal(status.status, 200, JSON.stringify(status.corpo));
        }
        return { funcionarioId, usuarioId, nome, email, token };
    };

    const linha = async (sql: string, valores: unknown[]) => (await db.query<RowDataPacket[]>(sql, valores))[0][0];
    const todoOTexto = async (id: number) => JSON.stringify((await db.query<RowDataPacket[]>('SELECT * FROM funcionarios WHERE id = ?', [id]))[0]);

    before(async () => {
        await banco.preparar();
        const { server, baseUrl } = await subirServidor(criarApp({ limitesAuth: LIMITES_AUTH_FOLGADOS }));
        servidor = server;
        chamar = criarCliente(baseUrl);
        empresa = (await criarEmpresa(db)).empresaId;
        admin = { token: (await criarUsuario(db, { empresaId: empresa, perfil: 'Administrador' })).token, funcionarioId: null };
        rh = (await criarUsuario(db, { empresaId: empresa, perfil: 'RH' })).token;
        folhaFechada = (await db.query<ResultSetHeader>(
            `INSERT INTO folhas (empresa_id, competencia, status, razao_social, cnpj, pendencias, fechada_em)
             VALUES (?, '2026-09', 'fechada', 'Razao Social Ficticia Ltda', '11222333000181', '[]', CURRENT_TIMESTAMP)`, [empresa]
        ))[0].insertId;
        colaboradorAtivo = (await criarColaborador(db, empresa, { nome: 'Colaborador Ativo', salario: 2000 })).token;
        adminDeOutra = (await criarUsuario(db, { empresaId: (await criarEmpresa(db)).empresaId, perfil: 'Administrador' })).token;
    });

    after(async () => {
        await pararServidor(servidor);
        await db.end();
        await banco.encerrar();
    });

    describe('a foto não fica em base64 nem trafega', () => {
        it('GET /api/funcionarios não traz avatar, e SELECT * FROM funcionarios não contém base64', async () => {
            const { funcionarioId, nome } = await titular({ desligar: false });
            const lista = await chamar('GET', `/api/funcionarios?busca=${encodeURIComponent(nome)}`, admin.token);
            assert.equal(lista.status, 200);
            assert.equal(lista.corpo.length, 1);
            assert.ok(!('avatar' in lista.corpo[0]));
            assert.ok(!JSON.stringify(lista.corpo).includes('base64'));

            const [[cadastro]] = await db.query<RowDataPacket[]>('SELECT * FROM funcionarios WHERE id = ?', [funcionarioId]);
            assert.ok(!('avatar' in cadastro), 'a coluna avatar não existe mais');
            for (const [coluna, valor] of Object.entries(cadastro)) {
                if (typeof valor !== 'string') continue;
                assert.ok(!valor.startsWith('data:'), `${coluna} não guarda data URL`);
                assert.ok(!/^[A-Za-z0-9+/]{200,}={0,2}$/.test(valor), `${coluna} não guarda base64`);
            }

            const [[usuario]] = await db.query<RowDataPacket[]>('SELECT * FROM usuarios WHERE funcionario_id = ?', [funcionarioId]);
            assert.ok(!('avatar' in usuario));
            const [[foto]] = await db.query<RowDataPacket[]>('SELECT tipo, imagem FROM avatares WHERE usuario_id = ?', [usuario.id]);
            assert.equal(foto.tipo, 'image/png');
            assert.ok(Buffer.isBuffer(foto.imagem));
        });
    });

    describe('encarregado', () => {
        it('o colaborador vê no perfil o encarregado que o Administrador indicou, e deixa de ver quando ele é apagado', async () => {
            const dados = { razao_social: 'Razao Social Ficticia Ltda', cnpj: '11222333000181' };
            const antes = await chamar('GET', '/api/perfil/meus-dados', colaboradorAtivo);
            assert.equal(antes.corpo.encarregado, null);

            const indicado = await chamar('PUT', '/api/empresa', admin.token, { ...dados, encarregado_nome: 'Enzo Encarregado Ficticio', encarregado_email: 'encarregado@exemplo.invalid' });
            assert.equal(indicado.status, 200, JSON.stringify(indicado.corpo));
            const perfil = await chamar('GET', '/api/perfil/meus-dados', colaboradorAtivo);
            assert.deepEqual(perfil.corpo.encarregado, { nome: 'Enzo Encarregado Ficticio', email: 'encarregado@exemplo.invalid' });

            await chamar('PUT', '/api/empresa', admin.token, { ...dados, encarregado_nome: '', encarregado_email: '' });
            assert.equal((await chamar('GET', '/api/perfil/meus-dados', colaboradorAtivo)).corpo.encarregado, null);
        });
    });

    describe('exportar', () => {
        it('devolve em JSON tudo o que o sistema guarda do colaborador, sem a senha nem a imagem', async () => {
            const t = await titular();
            const exportacao = await chamar('GET', `/api/funcionarios/${t.funcionarioId}/exportar`, admin.token);
            assert.equal(exportacao.status, 200, JSON.stringify(exportacao.corpo));
            assert.match(exportacao.resposta.headers.get('content-type') ?? '', /application\/json/);
            assert.match(exportacao.resposta.headers.get('content-disposition') ?? '', new RegExp(`attachment; filename="colaborador-${t.funcionarioId}.json"`));
            assert.equal(exportacao.resposta.headers.get('cache-control'), 'no-store');

            const dados = exportacao.corpo;
            assert.equal(dados.titular.nome, t.nome);
            assert.equal(dados.titular.cpf, CPF);
            assert.equal(dados.titular.endereco, ENDERECO);
            assert.equal(dados.titular.banco, BANCO);
            assert.equal(Number(dados.titular.salario_base), 4500);
            assert.equal(dados.titular.status, 'Inativo');
            assert.equal(dados.contas_de_acesso.length, 1);
            assert.equal(dados.contas_de_acesso[0].email, t.email);
            assert.equal(dados.tem_avatar, true);
            assert.equal(dados.ponto.marcacoes.length, 2);
            assert.equal(Number(dados.ponto.marcacoes[0].latitude), -1.45502);
            assert.equal(dados.ponto.justificativas[0].texto, 'Consulta médica do filho, atestado anexo.');
            assert.equal(dados.holerites.length, 1);
            assert.equal(dados.holerites[0].competencia, '2026-09');
            assert.ok(dados.historico_contratual.length >= 1);
            assert.equal(dados.solicitacoes_de_alteracao.length, 1);
            assert.ok(dados.trilha_de_auditoria.some((registro: { acao: string }) => registro.acao === 'funcionario.desligado'));

            const texto = JSON.stringify(dados);
            assert.ok(!texto.includes('"senha"') && !texto.includes('hash-ficticio') && !texto.includes('$2'), 'a senha e o hash não saem');
            assert.ok(!texto.includes('base64') && !texto.includes('"imagem"') && !texto.includes('"miniatura"'), 'a foto não vai no arquivo');
        });

        it('quem exporta fica na trilha', async () => {
            const t = await titular();
            await chamar('GET', `/api/funcionarios/${t.funcionarioId}/exportar`, rh);
            const registro = await linha("SELECT perfil FROM auditoria WHERE acao = 'funcionario.exportado' AND entidade_id = ?", [t.funcionarioId]);
            assert.equal(registro.perfil, 'RH');
        });

        it('o RH exporta; o Colaborador recebe 403; outra empresa e id inexistente respondem 404; sem sessão 401', async () => {
            const t = await titular();
            assert.equal((await chamar('GET', `/api/funcionarios/${t.funcionarioId}/exportar`, rh)).status, 200);
            assert.equal((await chamar('GET', `/api/funcionarios/${t.funcionarioId}/exportar`, colaboradorAtivo)).status, 403);
            assert.equal((await chamar('GET', `/api/funcionarios/${t.funcionarioId}/exportar`, adminDeOutra)).status, 404);
            assert.equal((await chamar('GET', '/api/funcionarios/99999999/exportar', admin.token)).status, 404);
            assert.equal((await chamar('GET', `/api/funcionarios/${t.funcionarioId}/exportar`)).status, 401);
        });
    });

    describe('anonimizar', () => {
        it('substitui CPF, nome, e-mail, endereço e banco por valores neutros e mantém as marcações com o id', async () => {
            const t = await titular();
            const marcacoesAntes = (await db.query<RowDataPacket[]>('SELECT id FROM registro_pontos WHERE funcionario_id = ?', [t.funcionarioId]))[0].map((m) => m.id);

            const resposta = await chamar('POST', `/api/funcionarios/${t.funcionarioId}/anonimizar`, admin.token);
            assert.equal(resposta.status, 200, JSON.stringify(resposta.corpo));

            const cadastro = await linha('SELECT * FROM funcionarios WHERE id = ?', [t.funcionarioId]);
            assert.equal(cadastro.nome, `Colaborador anonimizado ${t.funcionarioId}`);
            assert.equal(cadastro.email, `anonimizado-${t.funcionarioId}@anonimizado.invalid`);
            for (const coluna of ['cpf', 'telefone', 'data_nascimento', 'endereco', 'banco', 'agencia', 'conta', 'tipo_conta']) {
                assert.equal(cadastro[coluna], null, coluna);
            }
            assert.ok(cadastro.anonimizado_em);
            assert.equal(Number(cadastro.salario_base), 4500, 'o salário e a situação ficam');
            assert.equal(cadastro.status, 'Inativo');
            assert.ok(!(await todoOTexto(t.funcionarioId)).includes(NOME));

            const marcacoes = (await db.query<RowDataPacket[]>('SELECT id, funcionario_id, latitude, longitude FROM registro_pontos WHERE funcionario_id = ?', [t.funcionarioId]))[0];
            assert.deepEqual(marcacoes.map((m) => m.id), marcacoesAntes, 'as marcações continuam, com o id');
            assert.ok(marcacoes.every((m) => m.latitude === null && m.longitude === null), 'a localização sai');
        });

        it('apaga também a conta de acesso, a foto, o nome no holerite, o texto da justificativa e o conteúdo pessoal da trilha', async () => {
            const t = await titular();
            await chamar('PUT', `/api/funcionarios/${t.funcionarioId}`, admin.token, { nome: `${t.nome} Editado`, email: t.email, cpf: CPF, salario_base: 5000 });
            assert.equal((await chamar('POST', `/api/funcionarios/${t.funcionarioId}/anonimizar`, admin.token)).status, 200);

            const conta = await linha('SELECT nome, email, senha_provisoria FROM usuarios WHERE id = ?', [t.usuarioId]);
            assert.equal(conta.nome, `Colaborador anonimizado ${t.funcionarioId}`);
            assert.equal(conta.email, `anonimizado-${t.funcionarioId}@anonimizado.invalid`);
            assert.equal((await db.query<RowDataPacket[]>('SELECT 1 FROM avatares WHERE usuario_id = ?', [t.usuarioId]))[0].length, 0);

            const holerite = await linha('SELECT nome, bruto FROM folha_itens WHERE funcionario_id = ?', [t.funcionarioId]);
            assert.equal(holerite.nome, `Colaborador anonimizado ${t.funcionarioId}`);
            assert.equal(Number(holerite.bruto), 4500, 'os valores da folha ficam');

            const justificativa = await linha('SELECT texto, status FROM justificativas_ponto WHERE funcionario_id = ?', [t.funcionarioId]);
            assert.equal(justificativa.texto, '[removido na anonimização]');

            const [trilha] = await db.query<RowDataPacket[]>('SELECT acao, usuario_id, ip, antes, depois FROM auditoria WHERE funcionario_id = ? ORDER BY id', [t.funcionarioId]);
            const texto = JSON.stringify(trilha);
            for (const pessoal of [NOME, CPF, ENDERECO, TELEFONE, t.email, 'Consulta médica', 'motivo de saúde']) {
                assert.ok(!texto.includes(pessoal), `a trilha ainda guarda "${pessoal}"`);
            }
            assert.ok(trilha.filter((r) => r.acao !== 'funcionario.anonimizado').every((r) => r.ip === null));
            assert.deepEqual(trilha.find((r) => r.acao === 'funcionario.salario_alterado')?.depois, { salario_base: 5000 }, 'o valor do salário é registro da folha e fica');
            assert.ok(trilha.some((r) => r.acao === 'funcionario.anonimizado'));
        });

        it('a conta anonimizada não abre mais, nem com o e-mail antigo nem com o neutro', async () => {
            const t = await titular();
            await chamar('POST', `/api/funcionarios/${t.funcionarioId}/anonimizar`, admin.token);
            assert.equal((await chamar('POST', '/api/auth/login', null, { email: t.email, senha: SENHA })).status, 401);
            assert.equal((await chamar('POST', '/api/auth/login', null, { email: `anonimizado-${t.funcionarioId}@anonimizado.invalid`, senha: SENHA })).status, 401);
            assert.equal((await chamar('GET', '/api/perfil/meus-dados', t.token)).status, 401, 'a sessão antiga caiu');
        });

        it('a exportação depois de anonimizar não traz dado pessoal', async () => {
            const t = await titular();
            await chamar('POST', `/api/funcionarios/${t.funcionarioId}/anonimizar`, admin.token);
            const texto = JSON.stringify((await chamar('GET', `/api/funcionarios/${t.funcionarioId}/exportar`, admin.token)).corpo);
            for (const pessoal of [NOME, CPF, ENDERECO, BANCO, TELEFONE, t.email, 'Consulta médica']) {
                assert.ok(!texto.includes(pessoal), `a exportação ainda traz "${pessoal}"`);
            }
        });

        it('o cadastro anonimizado aparece na lista como tal e não pode mais ser alterado, reativado nem ganhar senha', async () => {
            const t = await titular();
            await chamar('POST', `/api/funcionarios/${t.funcionarioId}/anonimizar`, admin.token);
            const lista = await chamar('GET', '/api/funcionarios?busca=anonimizado', admin.token);
            assert.equal(lista.corpo.find((f: { id: number }) => f.id === t.funcionarioId).anonimizado, true);

            assert.equal((await chamar('POST', `/api/funcionarios/${t.funcionarioId}/anonimizar`, admin.token)).status, 409, 'não anonimiza duas vezes');
            assert.equal((await chamar('PUT', `/api/funcionarios/${t.funcionarioId}`, admin.token, { nome: 'Volta', email: 'volta@exemplo.invalid' })).status, 409);
            assert.equal((await chamar('PATCH', `/api/funcionarios/${t.funcionarioId}/status`, admin.token, { status: 'Ativo' })).status, 409);
            assert.equal((await chamar('POST', `/api/funcionarios/${t.funcionarioId}/redefinir-senha`, admin.token)).status, 409);
        });

        it('só o Administrador anonimiza: RH e Colaborador recebem 403 e nada muda', async () => {
            const t = await titular();
            assert.equal((await chamar('POST', `/api/funcionarios/${t.funcionarioId}/anonimizar`, rh)).status, 403);
            assert.equal((await chamar('POST', `/api/funcionarios/${t.funcionarioId}/anonimizar`, colaboradorAtivo)).status, 403);
            assert.equal((await linha('SELECT cpf FROM funcionarios WHERE id = ?', [t.funcionarioId])).cpf, CPF);
        });

        it('quem ainda trabalha não é anonimizado, e o Administrador não anonimiza o próprio cadastro', async () => {
            const ativo = await titular({ desligar: false });
            const resposta = await chamar('POST', `/api/funcionarios/${ativo.funcionarioId}/anonimizar`, admin.token);
            assert.equal(resposta.status, 409);
            assert.match(resposta.corpo.erro, /desligado/);
            assert.equal((await linha('SELECT cpf FROM funcionarios WHERE id = ?', [ativo.funcionarioId])).cpf, CPF);

            const funcionarioId = await criarFuncionario(db, empresa, { nome: 'Admin Com Cadastro', salario: 1 });
            const { token } = await criarUsuario(db, { empresaId: empresa, perfil: 'Administrador', funcionarioId });
            assert.equal((await chamar('POST', `/api/funcionarios/${funcionarioId}/anonimizar`, token)).status, 403);
        });

        it('outra empresa e id inexistente respondem 404', async () => {
            const t = await titular();
            assert.equal((await chamar('POST', `/api/funcionarios/${t.funcionarioId}/anonimizar`, adminDeOutra)).status, 404);
            assert.equal((await chamar('POST', '/api/funcionarios/99999999/anonimizar', admin.token)).status, 404);
            assert.equal((await linha('SELECT anonimizado_em FROM funcionarios WHERE id = ?', [t.funcionarioId])).anonimizado_em, null);
        });
    });
});
