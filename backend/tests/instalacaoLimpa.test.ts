// Percorre os fluxos anunciados pela API (conta, empresa, estrutura, colaborador, perfil, ponto e folha)
// contra um banco recém migrado, sem nenhuma linha preparada à mão: se o schema não sustenta
// o que os controllers consultam e gravam, este teste quebra.
// Banco e variáveis em tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST o teste é pulado.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { cabecalhosDaSessao, tokenDaResposta } from './support/sessao.ts';
import { dataUrl } from './support/imagens.ts';
import pool from '../shared/db/pool.ts';
import authMiddleware from '../shared/middlewares/authMiddleware.ts';
import { authRoutes } from '../modules/auth/index.ts';
import { funcionariosRoutes } from '../modules/funcionarios/index.ts';
import { pontoRoutes } from '../modules/ponto/index.ts';
import { estruturaRoutes } from '../modules/estrutura/index.ts';
import { folhaRoutes } from '../modules/folha/index.ts';
import { empresaRoutes } from '../modules/empresa/index.ts';
import { perfilRoutes } from '../modules/perfil/index.ts';
import { mesLocal } from '../modules/ponto/ponto.fuso.ts';

describe('instalação limpa: fluxos de ponta a ponta', { skip: banco.skip }, () => {
    let server: http.Server, baseUrl: string;
    const estado: Record<string, any> = {};

    const chamar = async (metodo: string, caminho: string, token: string | null | undefined, corpo?: unknown) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
            body: corpo ? JSON.stringify(corpo) : undefined,
        });
        return { status: resposta.status, corpo: await resposta.json(), token: tokenDaResposta(resposta) };
    };

    const entrar = async (email: string, senha: string) => {
        const { status, token } = await chamar('POST', '/api/auth/login', null, { email, senha });
        assert.equal(status, 200);
        return token;
    };

    before(async () => {
        await banco.preparar();

        const app = express();
        app.use(express.json({ limit: '10mb' }));
        app.use('/api/auth', authRoutes);
        app.use('/api/funcionarios', authMiddleware, funcionariosRoutes);
        app.use('/api/ponto', authMiddleware, pontoRoutes);
        app.use('/api/estrutura', authMiddleware, estruturaRoutes);
        app.use('/api/folha', authMiddleware, folhaRoutes);
        app.use('/api/empresa', authMiddleware, empresaRoutes);
        app.use('/api/perfil', authMiddleware, perfilRoutes);
        server = http.createServer(app);
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    after(async () => {
        if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
        await pool.end();
        await banco.encerrar();
    });

    it('registra a conta e o administrador consegue entrar', async () => {
        const registro = await chamar('POST', '/api/auth/registrar', null, {
            nomeEmpresa: 'Empresa Ficticia Limpa', nomeAdmin: 'Admin Ficticio', email: 'admin@limpa.exemplo.invalid', senha: 'senha-ficticia',
        });
        assert.equal(registro.status, 201);
        estado.admin = await entrar('admin@limpa.exemplo.invalid', 'senha-ficticia');
    });

    it('a empresa nova já tem departamentos e cargos para o formulário de colaborador', async () => {
        const departamentos = await chamar('GET', '/api/estrutura/departamentos', estado.admin);
        const cargos = await chamar('GET', '/api/estrutura/cargos', estado.admin);
        assert.equal(departamentos.corpo.length, 4);
        assert.equal(cargos.corpo.length, 4);
        assert.ok(cargos.corpo.every((cargo: any) => cargo.departamento_nome));
    });

    it('cria, edita e remove departamentos e cargos', async () => {
        assert.equal((await chamar('POST', '/api/estrutura/departamentos', estado.admin, {
            nome: 'Operações Fictícias', sigla: 'OPE', descricao: 'Setor inventado', gestor: 'Gestora Ficticia',
        })).status, 201);
        const [operacoes] = (await chamar('GET', '/api/estrutura/departamentos', estado.admin)).corpo.filter((d: any) => d.sigla === 'OPE');
        estado.departamento = operacoes.id;

        assert.equal((await chamar('POST', '/api/estrutura/cargos', estado.admin, {
            nome: 'Analista de Operações', departamento_id: estado.departamento, nivel: 'Pleno', salario_base: 4300,
        })).status, 201);
        const cargos = (await chamar('GET', '/api/estrutura/cargos', estado.admin)).corpo;
        const analista = cargos.find((cargo: any) => cargo.nome === 'Analista de Operações');
        estado.cargo = analista.id;
        assert.equal(analista.departamento_nome, 'Operações Fictícias');
        assert.equal(Number(analista.salario_base), 4300);

        assert.equal((await chamar('PUT', `/api/estrutura/departamentos/${estado.departamento}`, estado.admin, {
            nome: 'Operações Renomeadas', sigla: 'OPE', descricao: null, gestor: null,
        })).status, 200);

        const efemero = await chamar('POST', '/api/estrutura/departamentos', estado.admin, { nome: 'Efêmero', sigla: 'EFE' });
        assert.equal(efemero.status, 201);
        const [{ id }] = (await chamar('GET', '/api/estrutura/departamentos', estado.admin)).corpo.filter((d: any) => d.sigla === 'EFE');
        assert.equal((await chamar('DELETE', `/api/estrutura/departamentos/${id}`, estado.admin)).status, 200);
    });

    it('cria o colaborador com todos os dados e ele entra com as próprias credenciais', async () => {
        const criado = await chamar('POST', '/api/funcionarios', estado.admin, {
            nome: 'Colaborador Ficticio', cpf: '000.000.000-99', email: 'colaborador@limpa.exemplo.invalid', telefone: '(00) 00000-0000',
            data_admissao: '2025-01-06', data_nascimento: '1990-05-17', endereco: 'Rua Inventada, 0',
            banco: 'Banco Ficticio', agencia: '0000', conta: '00000-0', tipo_conta: 'Corrente',
            cargo_id: estado.cargo, departamento_id: estado.departamento, tipo_contrato: 'Temporário', salario_base: 4300, senha: 'outra-senha-ficticia',
        });
        assert.equal(criado.status, 201);

        const lista = (await chamar('GET', '/api/funcionarios', estado.admin)).corpo;
        const colaborador = lista.find((f: any) => f.email === 'colaborador@limpa.exemplo.invalid');
        estado.funcionario = colaborador.id;
        assert.equal(colaborador.cargo_nome, 'Analista de Operações');
        assert.equal(colaborador.departamento_nome, 'Operações Renomeadas');
        assert.equal(colaborador.tipo_contrato, 'Temporário');

        estado.colaborador = await entrar('colaborador@limpa.exemplo.invalid', 'outra-senha-ficticia');
        const [[usuario]] = await pool.query<RowDataPacket[]>('SELECT id, funcionario_id FROM usuarios WHERE email = ?', ['colaborador@limpa.exemplo.invalid']);
        assert.equal(usuario.funcionario_id, estado.funcionario);
        estado.usuario = usuario.id;
    });

    it('o colaborador vê o perfil, atualiza dados com avatar e troca a senha', async () => {
        const perfil = await chamar('GET', '/api/perfil/meus-dados', estado.colaborador);
        assert.equal(perfil.status, 200);
        assert.equal(perfil.corpo.cargo, 'Analista de Operações');

        const avatar = dataUrl('png', 2048);
        assert.equal((await chamar('PUT', '/api/perfil/meus-dados', estado.colaborador, {
            nome: 'Colaborador Ficticio', email: 'colaborador@limpa.exemplo.invalid', telefone: '(00) 11111-1111', avatar,
        })).status, 200);
        const depois = await chamar('GET', '/api/perfil/meus-dados', estado.colaborador);
        assert.equal(depois.corpo.avatar, avatar);
        assert.equal(depois.corpo.telefone, '(00) 11111-1111');

        assert.equal(depois.corpo.banco, 'Banco Ficticio');
        assert.equal(depois.corpo.tipo_contrato, 'Temporário');
        assert.equal(depois.corpo.vinculado, true);

        assert.equal((await chamar('PUT', '/api/perfil/alterar-senha', estado.colaborador, {
            senhaAtual: 'outra-senha-ficticia', novaSenha: 'terceira-senha-ficticia',
        })).status, 200);
        // A troca de senha encerra a sessão: o token novo vem do login com a senha nova.
        estado.colaborador = await entrar('colaborador@limpa.exemplo.invalid', 'terceira-senha-ficticia');
    });

    it('o administrador tem perfil próprio sem funcionário', async () => {
        const perfil = await chamar('GET', '/api/perfil/meus-dados', estado.admin);
        assert.equal(perfil.corpo.perfil, 'Administrador');
        assert.equal(perfil.corpo.vinculado, false);
    });

    it('registra os quatro pontos do dia e o colaborador, o administrador e a listagem os enxergam', async () => {
        for (const tipo of ['Entrada', 'Pausa Almoço', 'Retorno Almoço', 'Saída']) {
            const registro = await chamar('POST', '/api/ponto/registrar', estado.colaborador, {
                tipo, latitude: -1.45502, longitude: -48.50240, observacao: 'registro de teste',
            });
            assert.equal(registro.status, 201, tipo);
        }
        const hoje = await chamar('GET', `/api/ponto/hoje/${estado.funcionario}`, estado.colaborador);
        assert.deepEqual(hoje.corpo.map((p: any) => p.type), ['Entrada', 'Pausa Almoço', 'Retorno Almoço', 'Saída']);

        const mes = mesLocal(Math.floor(Date.now() / 1000));
        const historico = await chamar('GET', `/api/ponto/historico/${estado.funcionario}?mes=${mes}`, estado.admin);
        assert.equal(historico.corpo.length, 1);
        assert.notEqual(historico.corpo[0].exit, '--:--');

        const todos = await chamar('GET', `/api/ponto?mes=${mes}`, estado.admin);
        assert.equal(todos.corpo.length, 4);
        assert.equal(todos.corpo[0].nome_funcionario, 'Colaborador Ficticio');
    });

    it('o administrador completa os dados legais da empresa', async () => {
        const antes = await chamar('GET', '/api/empresa', estado.admin);
        assert.equal(antes.corpo.nome, 'Empresa Ficticia Limpa');
        assert.equal(antes.corpo.cnpj, null);

        const salvo = await chamar('PUT', '/api/empresa', estado.admin, { razao_social: 'Empresa Ficticia Limpa Ltda', cnpj: '11.222.333/0001-81', regime_tributario: 'Simples Nacional' });
        assert.equal(salvo.status, 200);
        assert.deepEqual(salvo.corpo, { nome: 'Empresa Ficticia Limpa', razao_social: 'Empresa Ficticia Limpa Ltda', cnpj: '11222333000181', regime_tributario: 'Simples Nacional' });
    });

    it('processa e fecha a folha da competência e entrega o holerite individual', async () => {
        const competencia = mesLocal(Math.floor(Date.now() / 1000));
        const processada = await chamar('POST', `/api/folha/competencias/${competencia}/processar`, estado.admin);
        assert.equal(processada.status, 201);
        assert.equal(processada.corpo.itens.length, 1);
        assert.equal(processada.corpo.itens[0].role, 'Analista de Operações');
        assert.equal(processada.corpo.itens[0].baseSalary, 4300);

        assert.equal((await chamar('GET', `/api/folha/meu-holerite?competencia=${competencia}`, estado.colaborador)).status, 404, 'folha aberta não aparece para o colaborador');
        assert.equal((await chamar('POST', `/api/folha/competencias/${competencia}/fechar`, estado.admin)).status, 200);

        const holerite = await chamar('GET', `/api/folha/meu-holerite?competencia=${competencia}`, estado.colaborador);
        assert.equal(holerite.status, 200);
        assert.equal(holerite.corpo.id, String(estado.funcionario));
        assert.deepEqual(holerite.corpo.empresa, { razaoSocial: 'Empresa Ficticia Limpa Ltda', cnpj: '11222333000181' });
    });

    it('edita o colaborador (status Férias), que continua com holerite e por isso não pode ser excluído', async () => {
        const edicao = await chamar('PUT', `/api/funcionarios/${estado.funcionario}`, estado.admin, {
            nome: 'Colaborador Ficticio', email: 'colaborador@limpa.exemplo.invalid', cargo_id: estado.cargo,
            departamento_id: estado.departamento, tipo_contrato: 'CLT', salario_base: 4300, status: 'Férias',
        });
        assert.equal(edicao.status, 200);

        const recusada = await chamar('DELETE', `/api/funcionarios/${estado.funcionario}`, estado.admin);
        assert.equal(recusada.status, 409);
        const [[{ restantes }]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS restantes FROM funcionarios WHERE id = ?', [estado.funcionario]);
        assert.equal(restantes, 1);
    });

    it('sem holerite emitido, a exclusão leva login e pontos junto', async () => {
        // O produto não oferece reabrir nem apagar folha fechada: a limpeza é só do teste.
        await pool.query('DELETE FROM folhas');
        assert.equal((await chamar('DELETE', `/api/funcionarios/${estado.funcionario}`, estado.admin)).status, 200);
        const [[{ usuarios }]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS usuarios FROM usuarios WHERE funcionario_id IS NOT NULL');
        const [[{ pontos }]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS pontos FROM registro_pontos');
        assert.equal(usuarios, 0);
        assert.equal(pontos, 0);
    });

    it('o cargo ficou livre e pode ser removido', async () => {
        assert.equal((await chamar('DELETE', `/api/estrutura/cargos/${estado.cargo}`, estado.admin)).status, 200);
    });
});
