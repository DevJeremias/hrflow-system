// Percorre os fluxos anunciados pela API (conta, empresa, estrutura, colaborador, perfil, ponto e folha)
// contra um banco recém migrado, sem nenhuma linha preparada à mão: se o schema não sustenta
// o que os controllers consultam e gravam, este teste quebra.
// Banco e variáveis em tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST o teste é pulado.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { cabecalhosDaSessao, tokenDaResposta } from './support/sessao.ts';
import { novoCnpj } from './support/cnpj.ts';
import { imagemReal } from './support/imagens.ts';
import pool from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import { criarFuso } from '../shared/utils/fuso.ts';

const { mesLocal } = criarFuso('America/Belem');

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

        const app = criarApp();
        server = http.createServer(app);
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    after(async () => {
        if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
        await pool.end();
        await banco.encerrar();
    });

    const cnpjDoRegistro = novoCnpj();

    it('registra a conta e o administrador consegue entrar', async () => {
        const registro = await chamar('POST', '/api/auth/registrar', null, {
            nomeEmpresa: 'Empresa Ficticia Limpa', cnpj: cnpjDoRegistro, nomeAdmin: 'Admin Ficticio', email: 'admin@limpa.exemplo.invalid',
            senha: 'senha-ficticia', confirmacaoSenha: 'senha-ficticia',
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
            nome: 'Colaborador Ficticio', cpf: '529.982.247-25', email: 'colaborador@limpa.exemplo.invalid', telefone: '(00) 00000-0000',
            data_admissao: '2025-01-06', data_nascimento: '1990-05-17', logradouro: 'Rua Inventada', numero: '0', cidade: 'Belém', uf: 'PA',
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
        // A senha definida no cadastro é provisória: até trocá-la a sessão não alcança mais nada.
        assert.equal((await chamar('GET', '/api/perfil/meus-dados', estado.colaborador)).status, 403);
        const [[usuario]] = await pool.query<RowDataPacket[]>('SELECT id, funcionario_id FROM usuarios WHERE email = ?', ['colaborador@limpa.exemplo.invalid']);
        assert.equal(usuario.funcionario_id, estado.funcionario);
        estado.usuario = usuario.id;
    });

    it('o colaborador troca a senha provisória no primeiro acesso, vê o perfil e atualiza dados com avatar', async () => {
        assert.equal((await chamar('PUT', '/api/perfil/alterar-senha', estado.colaborador, {
            senhaAtual: 'outra-senha-ficticia', novaSenha: 'terceira-senha-ficticia',
        })).status, 200);
        // A troca de senha encerra a sessão: o token novo vem do login com a senha nova.
        estado.colaborador = await entrar('colaborador@limpa.exemplo.invalid', 'terceira-senha-ficticia');

        const perfil = await chamar('GET', '/api/perfil/meus-dados', estado.colaborador);
        assert.equal(perfil.status, 200);
        assert.equal(perfil.corpo.cargo, 'Analista de Operações');

        const avatar = await imagemReal('png');
        assert.equal((await chamar('PUT', '/api/perfil/meus-dados', estado.colaborador, {
            telefone: '(00) 11111-1111', avatar,
        })).status, 200);
        const depois = await chamar('GET', '/api/perfil/meus-dados', estado.colaborador);
        assert.match(depois.corpo.avatar, /^\/api\/perfil\/avatar\?v=\d+$/);
        const miniatura = await fetch(`${baseUrl}${depois.corpo.avatar}`, { headers: cabecalhosDaSessao(estado.colaborador) });
        assert.equal(miniatura.status, 200);
        assert.equal(miniatura.headers.get('content-type'), 'image/webp');
        assert.equal(depois.corpo.telefone, '(00) 11111-1111');

        assert.equal(depois.corpo.banco, 'Banco Ficticio');
        assert.equal(depois.corpo.tipo_contrato, 'Temporário');
        assert.equal(depois.corpo.vinculado, true);
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
        const marcados = historico.corpo.filter((d: any) => d.exit !== '--:--');
        assert.equal(marcados.length, 1);

        const todos = await chamar('GET', `/api/ponto?mes=${mes}`, estado.admin);
        assert.equal(todos.corpo.length, 4);
        assert.equal(todos.corpo[0].nome_funcionario, 'Colaborador Ficticio');
    });

    it('o administrador completa os dados legais da empresa', async () => {
        const antes = await chamar('GET', '/api/empresa', estado.admin);
        assert.equal(antes.corpo.nome, 'Empresa Ficticia Limpa');
        assert.equal(antes.corpo.cnpj, cnpjDoRegistro, 'o CNPJ do cadastro da conta já está na empresa');
        assert.equal(antes.corpo.razao_social, null);

        const salvo = await chamar('PUT', '/api/empresa', estado.admin, { razao_social: 'Empresa Ficticia Limpa Ltda', cnpj: '11.222.333/0001-81', regime_tributario: 'Simples Nacional' });
        assert.equal(salvo.status, 200);
        assert.deepEqual(salvo.corpo, { nome: 'Empresa Ficticia Limpa', razao_social: 'Empresa Ficticia Limpa Ltda', cnpj: '11222333000181', regime_tributario: 'Simples Nacional', fuso: 'America/Belem', encarregado_nome: null, encarregado_email: null });
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

    it('edita o colaborador, põe de férias e recusa excluir quem já tem ponto ou holerite; sem movimento a exclusão leva o login junto', async () => {
        const edicao = await chamar('PATCH', `/api/funcionarios/${estado.funcionario}`, estado.admin, {
            nome: 'Colaborador Ficticio', email: 'colaborador@limpa.exemplo.invalid', cargo_id: estado.cargo,
            departamento_id: estado.departamento, tipo_contrato: 'CLT', salario_base: 4300,
        });
        assert.equal(edicao.status, 200);
        assert.equal((await chamar('PATCH', `/api/funcionarios/${estado.funcionario}/status`, estado.admin, { status: 'Férias' })).status, 200);

        assert.equal((await chamar('DELETE', `/api/funcionarios/${estado.funcionario}`, estado.admin)).status, 409);
        const [[{ antes }]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS antes FROM registro_pontos');
        assert.equal(antes, 4, 'o ponto continua guardado');

        // O produto não oferece apagar ponto nem folha fechada: a limpeza é só do teste.
        await pool.query('DELETE FROM registro_pontos');
        assert.equal((await chamar('DELETE', `/api/funcionarios/${estado.funcionario}`, estado.admin)).status, 409, 'o holerite emitido também protege');
        await pool.query('DELETE FROM folhas');
        assert.equal((await chamar('DELETE', `/api/funcionarios/${estado.funcionario}`, estado.admin)).status, 200);
        const [[{ usuarios }]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS usuarios FROM usuarios WHERE funcionario_id IS NOT NULL');
        assert.equal(usuarios, 0);
    });

    it('o cargo ficou livre e pode ser removido', async () => {
        assert.equal((await chamar('DELETE', `/api/estrutura/cargos/${estado.cargo}`, estado.admin)).status, 200);
    });
});
