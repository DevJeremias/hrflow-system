// B-13: ciclo de vida do colaborador. Desligar é inativar com data e motivo, sem perder o histórico;
// só o cadastro sem movimento é excluído; o RH redefine a senha e o colaborador a troca no primeiro
// acesso. Cada cenário vai de ponta a ponta contra o MySQL migrado (tests/support/bancoDeTeste.ts);
// sem HRFLOW_TEST_DB_HOST os testes são marcados como ignorados, nunca como aprovados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import express from 'express';
import bcrypt from 'bcrypt';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { cabecalhosDaSessao, criarUsuario, tokenDaResposta } from './support/sessao.ts';
import { pararServidor, subirServidor } from './support/servidor.ts';
import pool from '../shared/db/pool.ts';
import authMiddleware from '../shared/middlewares/authMiddleware.ts';
import { criarAuthRouter } from '../modules/auth/index.ts';
import { funcionariosRoutes } from '../modules/funcionarios/index.ts';
import { folhaRoutes } from '../modules/folha/index.ts';
import { perfilRoutes } from '../modules/perfil/index.ts';
import { gerarSenhaProvisoria } from '../modules/funcionarios/funcionarios.regras.ts';
import { mesLocal } from '../modules/ponto/ponto.fuso.ts';
import { validarSenhaDeRegistro } from '../shared/schemas/validadores.ts';

describe('ciclo de vida do colaborador (B-13)', { skip: banco.skip }, () => {
    let server: http.Server;
    let baseUrl: string;
    let empresaA: number;
    let empresaB: number;
    let tokenAdmin: string | undefined;
    let tokenRH: string | undefined;
    let tokenAdminB: string | undefined;
    let funcionarioDoRH: number;
    let sequencia = 0;

    const chamar = async (metodo: string, caminho: string, token: string | undefined | null, corpo?: object) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
            body: corpo ? JSON.stringify(corpo) : undefined,
        });
        return { status: resposta.status, corpo: await resposta.json(), token: tokenDaResposta(resposta), cabecalhos: resposta.headers };
    };

    const login = (email: string, senha: string) => chamar('POST', '/api/auth/login', null, { email, senha });
    const consultar = async <T extends RowDataPacket>(sql: string, valores: unknown[]): Promise<T[]> => (await pool.query<T[]>(sql, valores))[0];

    // Colaborador criado pela API, como o RH faria, com a senha informada. O cadastro nasce com
    // senha provisória; `jaTrocou` simula quem já escolheu a própria.
    const novoColaborador = async ({ jaTrocou = true, token = tokenAdmin as string | undefined } = {}) => {
        sequencia += 1;
        const email = `colaborador${sequencia}@ciclo.exemplo.invalid`;
        const senha = 'senha-ficticia-1';
        const criado = await chamar('POST', '/api/funcionarios', token, { nome: `Colaborador Ficticio ${sequencia}`, email, senha, data_admissao: '2024-01-02' });
        assert.equal(criado.status, 201, JSON.stringify(criado.corpo));
        const [{ id }] = await consultar('SELECT id FROM funcionarios WHERE email = ?', [email]);
        if (jaTrocou) await pool.query('UPDATE usuarios SET senha_provisoria = FALSE WHERE funcionario_id = ?', [id]);
        const entrada = await login(email, senha);
        assert.equal(entrada.status, 200);
        return { id: id as number, email, senha, token: entrada.token };
    };

    const marcarPonto = (funcionarioId: number, empresaId = empresaA) => pool.query(
        "INSERT INTO registro_pontos (funcionario_id, empresa_id, tipo_registro) VALUES (?, ?, 'Entrada')", [funcionarioId, empresaId]
    );

    const desligar = (id: number, token = tokenAdmin, extra: object = {}) => chamar('PATCH', `/api/funcionarios/${id}/status`, token, {
        status: 'Inativo', data_desligamento: '2026-01-10', motivo_desligamento: 'Pedido de demissão', ...extra,
    });

    before(async () => {
        await banco.preparar();

        const app = express();
        app.use(express.json());
        app.use('/api/auth', criarAuthRouter({
            loginPorIp: { windowMs: 60_000, limit: 1000 },
            loginPorIdentidade: { windowMs: 60_000, limit: 1000 },
            registroPorIp: { windowMs: 60_000, limit: 1000 },
            registroPorIdentidade: { windowMs: 60_000, limit: 1000 },
        }));
        app.use('/api/funcionarios', authMiddleware, funcionariosRoutes);
        app.use('/api/folha', authMiddleware, folhaRoutes);
        app.use('/api/perfil', authMiddleware, perfilRoutes);
        ({ server, baseUrl } = await subirServidor(app));

        empresaA = (await pool.query<ResultSetHeader>('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ciclo Ficticia A']))[0].insertId;
        empresaB = (await pool.query<ResultSetHeader>('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ciclo Ficticia B']))[0].insertId;
        tokenAdmin = (await criarUsuario(pool, { empresaId: empresaA, perfil: 'Administrador' })).token;
        tokenAdminB = (await criarUsuario(pool, { empresaId: empresaB, perfil: 'Administrador' })).token;
        funcionarioDoRH = (await pool.query<ResultSetHeader>('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['RH Ficticio', 'rh@ciclo.exemplo.invalid', empresaA]))[0].insertId;
        tokenRH = (await criarUsuario(pool, { empresaId: empresaA, perfil: 'RH', funcionarioId: funcionarioDoRH })).token;
    });

    after(async () => {
        await pararServidor(server);
        await pool.end();
        await banco.encerrar();
    });

    describe('exclusão só do cadastro sem movimento', () => {
        it('colaborador com 1 marcação: 409 e nada é apagado', async () => {
            const { id, email } = await novoColaborador();
            await marcarPonto(id);

            const { status, corpo } = await chamar('DELETE', `/api/funcionarios/${id}`, tokenAdmin);
            assert.equal(status, 409);
            assert.match(corpo.erro, /registros de ponto.*Inative-o/);
            assert.equal((await consultar('SELECT id FROM funcionarios WHERE id = ?', [id])).length, 1);
            assert.equal((await consultar('SELECT id FROM usuarios WHERE funcionario_id = ?', [id])).length, 1);
            assert.equal((await consultar('SELECT id FROM registro_pontos WHERE funcionario_id = ?', [id])).length, 1);
            assert.equal((await login(email, 'senha-ficticia-1')).status, 200, 'o acesso continua valendo');
        });

        it('colaborador só com justificativa também é 409', async () => {
            const { id } = await novoColaborador();
            await pool.query("INSERT INTO justificativas_ponto (empresa_id, funcionario_id, data_referencia, texto) VALUES (?, ?, '2026-01-05', 'Consulta médica')", [empresaA, id]);

            assert.equal((await chamar('DELETE', `/api/funcionarios/${id}`, tokenAdmin)).status, 409);
            assert.equal((await consultar('SELECT id FROM justificativas_ponto WHERE funcionario_id = ?', [id])).length, 1);
        });

        it('cadastro sem movimento é excluído com o acesso', async () => {
            const { id } = await novoColaborador();
            assert.equal((await chamar('DELETE', `/api/funcionarios/${id}`, tokenAdmin)).status, 200);
            assert.equal((await consultar('SELECT id FROM funcionarios WHERE id = ?', [id])).length, 0);
            assert.equal((await consultar('SELECT id FROM usuarios WHERE funcionario_id = ?', [id])).length, 0);
        });

        it('o banco também recusa apagar quem tem ponto ou justificativa (RESTRICT, não CASCADE)', async () => {
            const { id } = await novoColaborador();
            await marcarPonto(id);
            await assert.rejects(pool.query('DELETE FROM funcionarios WHERE id = ?', [id]), (erro: { code?: string }) => erro.code === 'ER_ROW_IS_REFERENCED_2');

            const { id: outro } = await novoColaborador();
            await pool.query("INSERT INTO justificativas_ponto (empresa_id, funcionario_id, data_referencia, texto) VALUES (?, ?, '2026-01-05', 'x')", [empresaA, outro]);
            await assert.rejects(pool.query('DELETE FROM funcionarios WHERE id = ?', [outro]), (erro: { code?: string }) => erro.code === 'ER_ROW_IS_REFERENCED_2');
        });
    });

    describe('constraints da migration 0011', () => {
        it('o banco recusa data e motivo de desligamento em quem não está Inativo', async () => {
            const { id } = await novoColaborador();
            for (const sql of [
                "UPDATE funcionarios SET data_desligamento = '2026-01-10' WHERE id = ?",
                "UPDATE funcionarios SET motivo_desligamento = 'x' WHERE id = ?",
            ]) {
                await assert.rejects(pool.query(sql, [id]), (erro: { code?: string }) => erro.code === 'ER_CHECK_CONSTRAINT_VIOLATED');
            }
            await pool.query("UPDATE funcionarios SET status = 'Inativo', data_desligamento = '2026-01-10', motivo_desligamento = 'x' WHERE id = ?", [id]);
        });
    });

    describe('desligar, reativar e férias (PATCH /:id/status)', () => {
        it('desligar grava data e motivo, derruba o token antigo, bloqueia o login e preserva o histórico', async () => {
            const { id, email, senha, token } = await novoColaborador();
            await marcarPonto(id);
            assert.equal((await chamar('GET', '/api/perfil/meus-dados', token)).status, 200);
            const [{ sessao_versao: antes }] = await consultar('SELECT sessao_versao FROM usuarios WHERE funcionario_id = ?', [id]);

            const { status, corpo } = await desligar(id);
            assert.equal(status, 200, JSON.stringify(corpo));
            assert.equal(corpo.status, 'Inativo');
            assert.equal(corpo.data_desligamento, '2026-01-10');
            assert.equal(corpo.motivo_desligamento, 'Pedido de demissão');

            const [gravado] = await consultar("SELECT status, DATE_FORMAT(data_desligamento, '%Y-%m-%d') AS data_desligamento, motivo_desligamento FROM funcionarios WHERE id = ?", [id]);
            assert.deepEqual({ ...gravado }, { status: 'Inativo', data_desligamento: '2026-01-10', motivo_desligamento: 'Pedido de demissão' });
            assert.equal((await consultar('SELECT sessao_versao FROM usuarios WHERE funcionario_id = ?', [id]))[0].sessao_versao, antes + 1);

            assert.equal((await chamar('GET', '/api/perfil/meus-dados', token)).status, 401, 'o token emitido antes deixa de valer');
            const tentativa = await login(email, senha);
            assert.equal(tentativa.status, 403);
            assert.equal(tentativa.token, undefined);

            assert.equal((await consultar('SELECT id FROM registro_pontos WHERE funcionario_id = ?', [id])).length, 1, 'o ponto continua no banco');
            assert.equal((await consultar('SELECT id FROM usuarios WHERE funcionario_id = ?', [id])).length, 1, 'o acesso não foi apagado');
        });

        it('reativar limpa data e motivo e devolve o login, sem ressuscitar o token antigo', async () => {
            const { id, email, senha, token } = await novoColaborador();
            await desligar(id);

            const { status, corpo } = await chamar('PATCH', `/api/funcionarios/${id}/status`, tokenAdmin, { status: 'Ativo' });
            assert.equal(status, 200);
            assert.equal(corpo.data_desligamento, null);
            const [linha] = await consultar('SELECT status, data_desligamento, motivo_desligamento FROM funcionarios WHERE id = ?', [id]);
            assert.deepEqual({ ...linha }, { status: 'Ativo', data_desligamento: null, motivo_desligamento: null });

            assert.equal((await chamar('GET', '/api/perfil/meus-dados', token)).status, 401);
            assert.equal((await login(email, senha)).status, 200);
        });

        it('Férias é um status válido que não derruba a sessão', async () => {
            const { id, token } = await novoColaborador();
            const { status } = await chamar('PATCH', `/api/funcionarios/${id}/status`, tokenAdmin, { status: 'Férias' });
            assert.equal(status, 200);
            assert.equal((await consultar('SELECT status FROM funcionarios WHERE id = ?', [id]))[0].status, 'Férias');
            assert.equal((await chamar('GET', '/api/perfil/meus-dados', token)).status, 200);
        });

        it('exige data e motivo, recusa data futura e anterior à admissão, e não grava nada', async () => {
            const { id } = await novoColaborador();
            assert.equal((await chamar('PATCH', `/api/funcionarios/${id}/status`, tokenAdmin, { status: 'Inativo' })).status, 400);
            assert.equal((await desligar(id, tokenAdmin, { data_desligamento: '2999-01-01' })).status, 400);

            const anterior = await desligar(id, tokenAdmin, { data_desligamento: '2023-12-31' });
            assert.equal(anterior.status, 400);
            assert.match(anterior.corpo.erro, /anterior à data de admissão/);

            assert.equal((await consultar('SELECT status FROM funcionarios WHERE id = ?', [id]))[0].status, 'Ativo');
        });

        it('a listagem traz data, motivo, perfil do acesso e se há movimento', async () => {
            const { id } = await novoColaborador();
            const { id: comPonto } = await novoColaborador();
            await marcarPonto(comPonto);
            await desligar(id);

            const { corpo } = await chamar('GET', '/api/funcionarios?limite=100', tokenAdmin);
            const linha = corpo.find((f: { id: number }) => f.id === id);
            assert.equal(linha.status, 'Inativo');
            assert.equal(linha.data_desligamento, '2026-01-10');
            assert.equal(linha.motivo_desligamento, 'Pedido de demissão');
            assert.equal(linha.usuario_perfil, 'Colaborador');
            assert.equal(linha.tem_movimento, false);
            assert.equal(corpo.find((f: { id: number }) => f.id === comPonto).tem_movimento, true);
            assert.equal(corpo.find((f: { id: number }) => f.id === funcionarioDoRH).usuario_perfil, 'RH');
        });

        it('Colaborador, outra empresa e funcionário inexistente não alteram a situação', async () => {
            const { id, token } = await novoColaborador();
            assert.equal((await desligar(id, token)).status, 403);
            assert.equal((await desligar(id, tokenAdminB)).status, 404);
            assert.equal((await desligar(999999)).status, 404);
            assert.equal((await chamar('PATCH', `/api/funcionarios/${id}/status`, null, { status: 'Férias' })).status, 401);
            assert.equal((await consultar('SELECT status FROM funcionarios WHERE id = ?', [id]))[0].status, 'Ativo');
        });

        it('o RH inativa colaborador, mas não outro RH nem o próprio cadastro', async () => {
            const { id } = await novoColaborador();
            assert.equal((await desligar(id, tokenRH)).status, 200);

            const outroRH = (await pool.query<ResultSetHeader>('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['Outro RH Ficticio', 'outro.rh@ciclo.exemplo.invalid', empresaA]))[0].insertId;
            await criarUsuario(pool, { empresaId: empresaA, perfil: 'RH', funcionarioId: outroRH });
            assert.equal((await desligar(outroRH, tokenRH)).status, 403);
            assert.equal((await desligar(funcionarioDoRH, tokenRH)).status, 403);
            assert.equal((await desligar(outroRH, tokenAdmin)).status, 200, 'o Administrador pode');
        });
    });

    describe('folha', () => {
        // Processa a competência pela API e devolve os colaboradores que entraram nela.
        const nomesNaFolha = async (competencia: string, token = tokenAdmin) => {
            const { status, corpo } = await chamar('POST', `/api/folha/competencias/${competencia}/processar`, token);
            assert.ok(status === 200 || status === 201, JSON.stringify(corpo));
            return corpo.itens.map((h: { id: string }) => Number(h.id));
        };

        it('quem foi desligado neste mês segue na folha dele; a partir do mês seguinte sai', async () => {
            const { id: ativo } = await novoColaborador();
            const { id: desligadoHoje } = await novoColaborador();
            const { id: desligadoNoMesPassado } = await novoColaborador();
            const hoje = new Date().toISOString().slice(0, 10);
            const mesPassado = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15)).toISOString().slice(0, 10);
            await pool.query('UPDATE funcionarios SET data_admissao = ? WHERE id IN (?, ?)', ['2020-01-01', desligadoHoje, desligadoNoMesPassado]);
            // Sem salário a pessoa vira pendência, não holerite: a folha só lista quem tem o que pagar.
            await pool.query('UPDATE funcionarios SET salario_base = 3000 WHERE id IN (?, ?, ?)', [ativo, desligadoHoje, desligadoNoMesPassado]);
            assert.equal((await desligar(desligadoHoje, tokenAdmin, { data_desligamento: hoje })).status, 200);
            assert.equal((await desligar(desligadoNoMesPassado, tokenAdmin, { data_desligamento: mesPassado })).status, 200);

            try {
                const folha = await nomesNaFolha(mesLocal(Math.floor(Date.now() / 1000)));
                assert.ok(folha.includes(ativo));
                assert.ok(folha.includes(desligadoHoje), 'o mês do desligamento ainda é pago');
                assert.ok(!folha.includes(desligadoNoMesPassado), 'a competência seguinte ao desligamento não o inclui');
            } finally {
                // Quem tem holerite não pode ser excluído: a folha do teste não deve travar os cenários seguintes.
                await pool.query('DELETE FROM folhas');
            }
        });
    });

    describe('redefinir senha (POST /:id/redefinir-senha)', () => {
        it('o RH recebe a senha provisória uma única vez; o banco guarda só o hash e a sessão antiga cai', async () => {
            const { id, email, token } = await novoColaborador();
            const [{ sessao_versao: antes }] = await consultar('SELECT sessao_versao FROM usuarios WHERE funcionario_id = ?', [id]);

            const { status, corpo, cabecalhos } = await chamar('POST', `/api/funcionarios/${id}/redefinir-senha`, tokenRH);
            assert.equal(status, 200, JSON.stringify(corpo));
            assert.equal(validarSenhaDeRegistro(corpo.senhaProvisoria), null, 'a senha provisória cumpre a regra de senha');
            assert.equal(cabecalhos.get('cache-control'), 'no-store');

            const [acesso] = await consultar('SELECT senha, senha_provisoria, sessao_versao FROM usuarios WHERE funcionario_id = ?', [id]);
            assert.notEqual(acesso.senha, corpo.senhaProvisoria);
            assert.equal(await bcrypt.compare(corpo.senhaProvisoria, acesso.senha), true);
            assert.equal(acesso.senha_provisoria, 1);
            assert.equal(acesso.sessao_versao, antes + 1);

            assert.equal((await chamar('GET', '/api/perfil/meus-dados', token)).status, 401, 'o token anterior não vale mais');
            assert.equal((await login(email, 'senha-ficticia-1')).status, 401, 'a senha antiga não vale mais');

            const listagem = JSON.stringify((await chamar('GET', '/api/funcionarios?limite=100', tokenRH)).corpo);
            assert.ok(!listagem.includes(corpo.senhaProvisoria), 'nenhuma rota devolve a senha de novo');
            assert.ok(!listagem.includes(acesso.senha), 'nem o hash');
        });

        it('com a senha provisória o login só permite trocar a senha; depois da troca o acesso é normal', async () => {
            const { id, email } = await novoColaborador();
            const { corpo: { senhaProvisoria } } = await chamar('POST', `/api/funcionarios/${id}/redefinir-senha`, tokenRH);

            const entrada = await login(email, senhaProvisoria);
            assert.equal(entrada.status, 200);
            assert.equal(entrada.corpo.senhaProvisoria, true);
            const token = entrada.token;

            const sessao = await chamar('GET', '/api/auth/sessao', token);
            assert.equal(sessao.status, 200);
            assert.equal(sessao.corpo.senha_provisoria, true);

            for (const [metodo, caminho] of [['GET', '/api/perfil/meus-dados'], ['PUT', '/api/perfil/meus-dados'], ['GET', '/api/folha/meus-holerites'], ['GET', '/api/funcionarios']]) {
                const bloqueada = await chamar(metodo, caminho, token, metodo === 'PUT' ? { nome: 'x', email } : undefined);
                assert.equal(bloqueada.status, 403, `${metodo} ${caminho}`);
                assert.equal(bloqueada.corpo.senhaProvisoria, true);
            }

            const igual = await chamar('PUT', '/api/perfil/alterar-senha', token, { senhaAtual: senhaProvisoria, novaSenha: senhaProvisoria });
            assert.equal(igual.status, 400, 'a senha nova precisa ser diferente da provisória');
            assert.equal((await chamar('PUT', '/api/perfil/alterar-senha', token, { senhaAtual: 'errada-ficticia', novaSenha: 'senha-nova-ficticia' })).status, 400);
            assert.equal((await chamar('PUT', '/api/perfil/alterar-senha', token, { senhaAtual: senhaProvisoria, novaSenha: 'senha-nova-ficticia' })).status, 200);

            const [{ senha_provisoria }] = await consultar('SELECT senha_provisoria FROM usuarios WHERE funcionario_id = ?', [id]);
            assert.equal(senha_provisoria, 0);
            assert.equal((await login(email, senhaProvisoria)).status, 401);

            const nova = await login(email, 'senha-nova-ficticia');
            assert.equal(nova.status, 200);
            assert.equal(nova.corpo.senhaProvisoria, false);
            assert.equal((await chamar('GET', '/api/perfil/meus-dados', nova.token)).status, 200);
            assert.equal((await chamar('GET', '/api/folha/meus-holerites', nova.token)).status, 200);
        });

        it('o cadastro novo também nasce com senha provisória', async () => {
            const { email, senha, token } = await novoColaborador({ jaTrocou: false });
            assert.equal((await login(email, senha)).corpo.senhaProvisoria, true);
            assert.equal((await chamar('GET', '/api/perfil/meus-dados', token)).status, 403);
        });

        it('o RH não redefine a senha de outro RH, de Administrador vinculado ou a própria; o Administrador redefine a do RH', async () => {
            assert.equal((await chamar('POST', `/api/funcionarios/${funcionarioDoRH}/redefinir-senha`, tokenRH)).status, 403);

            const outroRH = (await pool.query<ResultSetHeader>('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['Outro RH Senha', 'outro.rh.senha@ciclo.exemplo.invalid', empresaA]))[0].insertId;
            await criarUsuario(pool, { empresaId: empresaA, perfil: 'RH', funcionarioId: outroRH });
            const adminVinculado = (await pool.query<ResultSetHeader>('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['Admin Vinculado', 'admin.vinculado@ciclo.exemplo.invalid', empresaA]))[0].insertId;
            await criarUsuario(pool, { empresaId: empresaA, perfil: 'Administrador', funcionarioId: adminVinculado });

            assert.equal((await chamar('POST', `/api/funcionarios/${outroRH}/redefinir-senha`, tokenRH)).status, 403);
            assert.equal((await chamar('POST', `/api/funcionarios/${adminVinculado}/redefinir-senha`, tokenRH)).status, 403);
            assert.equal((await consultar('SELECT senha_provisoria FROM usuarios WHERE funcionario_id = ?', [outroRH]))[0].senha_provisoria, 0);

            assert.equal((await chamar('POST', `/api/funcionarios/${outroRH}/redefinir-senha`, tokenAdmin)).status, 200);
        });

        it('Colaborador, outra empresa, inexistente, sem acesso e inativo não redefinem', async () => {
            const { id, token } = await novoColaborador();
            assert.equal((await chamar('POST', `/api/funcionarios/${id}/redefinir-senha`, token)).status, 403);
            assert.equal((await chamar('POST', `/api/funcionarios/${id}/redefinir-senha`, null)).status, 401);
            assert.equal((await chamar('POST', `/api/funcionarios/${id}/redefinir-senha`, tokenAdminB)).status, 404);
            assert.equal((await chamar('POST', '/api/funcionarios/999999/redefinir-senha', tokenAdmin)).status, 404);

            const semAcesso = (await pool.query<ResultSetHeader>('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)', ['Sem Acesso', 'sem.acesso@ciclo.exemplo.invalid', empresaA]))[0].insertId;
            const resposta = await chamar('POST', `/api/funcionarios/${semAcesso}/redefinir-senha`, tokenAdmin);
            assert.equal(resposta.status, 404);
            assert.match(resposta.corpo.erro, /não tem acesso/);

            await desligar(id);
            const inativo = await chamar('POST', `/api/funcionarios/${id}/redefinir-senha`, tokenAdmin);
            assert.equal(inativo.status, 409);
            assert.match(inativo.corpo.erro, /Reative/);
        });
    });

    describe('gerarSenhaProvisoria', () => {
        it('gera senhas aceitas pela regra de senha, sem caracteres ambíguos e diferentes entre si', () => {
            const geradas = new Set(Array.from({ length: 200 }, gerarSenhaProvisoria));
            assert.equal(geradas.size, 200);
            for (const senha of geradas) {
                assert.equal(validarSenhaDeRegistro(senha), null);
                assert.match(senha, /^[abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/);
            }
        });
    });
});
