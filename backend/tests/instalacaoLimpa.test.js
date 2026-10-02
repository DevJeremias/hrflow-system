// Percorre os fluxos anunciados pela API (conta, estrutura, colaborador, perfil, ponto e folha)
// contra um banco recém migrado, sem nenhuma linha preparada à mão: se o schema não sustenta
// o que os controllers consultam e gravam, este teste quebra.
// Banco e variáveis em tests/support/bancoDeTeste.js; sem HRFLOW_TEST_DB_HOST o teste é pulado.
const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const banco = require('./support/bancoDeTeste');
const { dataUrl } = require('./support/imagens');

describe('instalação limpa: fluxos de ponta a ponta', { skip: banco.skip }, () => {
    let server, baseUrl, pool;
    const estado = {};

    const chamar = async (metodo, caminho, token, corpo) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
            body: corpo ? JSON.stringify(corpo) : undefined,
        });
        return { status: resposta.status, corpo: await resposta.json() };
    };

    const entrar = async (email, senha) => {
        const { status, corpo } = await chamar('POST', '/api/auth/login', null, { email, senha });
        assert.equal(status, 200);
        return corpo.token;
    };

    before(async () => {
        await banco.preparar();
        pool = require('../config/db');

        const express = require('express');
        const authMiddleware = require('../middlewares/authMiddleware');
        const app = express();
        app.use(express.json({ limit: '10mb' }));
        app.use('/api/auth', require('../routes/authRoutes'));
        app.use('/api/funcionarios', authMiddleware, require('../routes/funcionarioRoutes'));
        app.use('/api/ponto', authMiddleware, require('../routes/pontoRoutes'));
        app.use('/api/estrutura', authMiddleware, require('../routes/estruturaRoutes'));
        app.use('/api/folha', authMiddleware, require('../routes/folhaRoutes'));
        app.use('/api/perfil', authMiddleware, require('../routes/perfilRoutes'));
        app.use('/api/usuarios', authMiddleware, require('../routes/usuarioRoutes'));
        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(async () => {
        if (server) await new Promise((resolve) => server.close(resolve));
        if (pool) await pool.end();
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
        assert.ok(cargos.corpo.every((cargo) => cargo.departamento_nome));
    });

    it('cria, edita e remove departamentos e cargos', async () => {
        assert.equal((await chamar('POST', '/api/estrutura/departamentos', estado.admin, {
            nome: 'Operações Fictícias', sigla: 'OPE', descricao: 'Setor inventado', gestor: 'Gestora Ficticia',
        })).status, 201);
        const [operacoes] = (await chamar('GET', '/api/estrutura/departamentos', estado.admin)).corpo.filter((d) => d.sigla === 'OPE');
        estado.departamento = operacoes.id;

        assert.equal((await chamar('POST', '/api/estrutura/cargos', estado.admin, {
            nome: 'Analista de Operações', departamento_id: estado.departamento, nivel: 'Pleno', salario_base: 4300,
        })).status, 201);
        const cargos = (await chamar('GET', '/api/estrutura/cargos', estado.admin)).corpo;
        const analista = cargos.find((cargo) => cargo.nome === 'Analista de Operações');
        estado.cargo = analista.id;
        assert.equal(analista.departamento_nome, 'Operações Fictícias');
        assert.equal(Number(analista.salario_base), 4300);

        assert.equal((await chamar('PUT', `/api/estrutura/departamentos/${estado.departamento}`, estado.admin, {
            nome: 'Operações Renomeadas', sigla: 'OPE', descricao: null, gestor: null,
        })).status, 200);

        const efemero = await chamar('POST', '/api/estrutura/departamentos', estado.admin, { nome: 'Efêmero', sigla: 'EFE' });
        assert.equal(efemero.status, 201);
        const [{ id }] = (await chamar('GET', '/api/estrutura/departamentos', estado.admin)).corpo.filter((d) => d.sigla === 'EFE');
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
        const colaborador = lista.find((f) => f.email === 'colaborador@limpa.exemplo.invalid');
        estado.funcionario = colaborador.id;
        assert.equal(colaborador.cargo_nome, 'Analista de Operações');
        assert.equal(colaborador.departamento_nome, 'Operações Renomeadas');
        assert.equal(colaborador.tipo_contrato, 'Temporário');

        estado.colaborador = await entrar('colaborador@limpa.exemplo.invalid', 'outra-senha-ficticia');
        const [[usuario]] = await pool.query('SELECT id, funcionario_id FROM usuarios WHERE email = ?', ['colaborador@limpa.exemplo.invalid']);
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

        const contrato = await chamar('GET', '/api/usuarios/perfil', estado.colaborador);
        assert.equal(contrato.status, 200);
        assert.equal(contrato.corpo.banco, 'Banco Ficticio');
        assert.equal(contrato.corpo.nivel, null);

        assert.equal((await chamar('PUT', '/api/perfil/alterar-senha', estado.colaborador, {
            senhaAtual: 'outra-senha-ficticia', novaSenha: 'terceira-senha-ficticia',
        })).status, 200);
        // A troca de senha encerra a sessão: o token novo vem do login com a senha nova.
        estado.colaborador = await entrar('colaborador@limpa.exemplo.invalid', 'terceira-senha-ficticia');
    });

    it('o administrador tem perfil próprio sem funcionário', async () => {
        const perfil = await chamar('GET', '/api/perfil/meus-dados', estado.admin);
        assert.equal(perfil.corpo.isAdmin, true);
    });

    it('registra os quatro pontos do dia e o colaborador, o administrador e a listagem os enxergam', async () => {
        for (const tipo of ['Entrada', 'Pausa Almoço', 'Retorno Almoço', 'Saída']) {
            const registro = await chamar('POST', '/api/ponto/registrar', estado.colaborador, {
                tipo, latitude: -1.45502, longitude: -48.50240, observacao: 'registro de teste',
            });
            assert.equal(registro.status, 201, tipo);
        }
        const hoje = await chamar('GET', `/api/ponto/hoje/${estado.funcionario}`, estado.colaborador);
        assert.deepEqual(hoje.corpo.map((p) => p.type), ['Entrada', 'Pausa Almoço', 'Retorno Almoço', 'Saída']);

        const mes = require('../utils/fusoPonto').mesLocal(Math.floor(Date.now() / 1000));
        const historico = await chamar('GET', `/api/ponto/historico/${estado.funcionario}?mes=${mes}`, estado.admin);
        assert.equal(historico.corpo.length, 1);
        assert.notEqual(historico.corpo[0].exit, '--:--');

        const todos = await chamar('GET', '/api/ponto', estado.admin);
        assert.equal(todos.corpo.length, 4);
        assert.equal(todos.corpo[0].nome_funcionario, 'Colaborador Ficticio');
    });

    it('processa a folha da empresa e entrega o holerite individual', async () => {
        const folha = await chamar('GET', '/api/folha/processar', estado.admin);
        assert.equal(folha.corpo.length, 1);
        assert.equal(folha.corpo[0].role, 'Analista de Operações');
        assert.equal(folha.corpo[0].baseSalary, 4300);

        const holerite = await chamar('GET', '/api/folha/meu-holerite', estado.colaborador);
        assert.equal(holerite.status, 200);
        assert.equal(holerite.corpo[0].id, String(estado.funcionario));
    });

    it('edita o colaborador (status Férias) e a exclusão leva login e pontos junto', async () => {
        const edicao = await chamar('PUT', `/api/funcionarios/${estado.funcionario}`, estado.admin, {
            nome: 'Colaborador Ficticio', email: 'colaborador@limpa.exemplo.invalid', cargo_id: estado.cargo,
            departamento_id: estado.departamento, tipo_contrato: 'CLT', salario_base: 4300, status: 'Férias',
        });
        assert.equal(edicao.status, 200);

        assert.equal((await chamar('DELETE', `/api/funcionarios/${estado.funcionario}`, estado.admin)).status, 200);
        const [[{ usuarios }]] = await pool.query('SELECT COUNT(*) AS usuarios FROM usuarios WHERE funcionario_id IS NOT NULL');
        const [[{ pontos }]] = await pool.query('SELECT COUNT(*) AS pontos FROM registro_pontos');
        assert.equal(usuarios, 0);
        assert.equal(pontos, 0);
    });

    it('o cargo ficou livre e pode ser removido', async () => {
        assert.equal((await chamar('DELETE', `/api/estrutura/cargos/${estado.cargo}`, estado.admin)).status, 200);
    });
});
