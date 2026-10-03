// SEC-08 (lado do servidor): GET /api/auth/sessao responde "quem sou eu" com perfil e vínculo,
// lidos do banco, e todo token inválido ou expirado é 401, que o front-end trata em um só lugar.
// Banco e variáveis em tests/support/bancoDeTeste.js; sem HRFLOW_TEST_DB_HOST o teste é pulado.
const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const banco = require('./support/bancoDeTeste');
const { cabecalhosDaSessao, tokenDaResposta } = require('./support/sessao');

const SENHA = 'senha-ficticia-1';

describe('sessão canônica (GET /api/auth/sessao)', { skip: banco.skip }, () => {
    let server, baseUrl, pool;
    const ids = {};

    const get = async (token) => {
        const resposta = await fetch(`${baseUrl}/api/auth/sessao`, { headers: cabecalhosDaSessao(token) });
        return { status: resposta.status, corpo: await resposta.json() };
    };

    const entrar = async (email) => {
        const resposta = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha: SENHA }),
        });
        assert.equal(resposta.status, 200);
        return tokenDaResposta(resposta);
    };

    before(async () => {
        await banco.preparar();
        pool = require('../config/db');
        const { carregarFixtures } = require('../seeds/fixtures');
        await carregarFixtures(pool, { senha: SENHA });
        const [usuarios] = await pool.query('SELECT id, email, perfil, funcionario_id, empresa_id FROM usuarios');
        for (const u of usuarios) ids[u.email] = u;

        const express = require('express');
        const app = express();
        app.use('/api/auth', require('../routes/authRoutes'));
        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(async () => {
        if (server) await new Promise((resolve) => server.close(resolve));
        if (pool) await pool.end();
        await banco.encerrar();
    });

    it('Administrador: perfil, empresa e nenhum vínculo de funcionário', async () => {
        const { status, corpo } = await get(await entrar('admin@alfa.exemplo.invalid'));
        const admin = ids['admin@alfa.exemplo.invalid'];
        assert.equal(status, 200);
        assert.deepEqual(corpo, {
            id: admin.id, perfil: 'Administrador', empresa_id: admin.empresa_id, empresa_nome: 'Empresa Ficticia Alfa Ltda',
            funcionario_id: null, avatar: null, nome: 'Admin Alfa Ficticio',
        });
    });

    it('RH: o perfil RH e o vínculo vêm do banco', async () => {
        const { status, corpo } = await get(await entrar('rita.rh@alfa.exemplo.invalid'));
        const rita = ids['rita.rh@alfa.exemplo.invalid'];
        assert.equal(status, 200);
        assert.equal(corpo.perfil, 'RH');
        assert.equal(corpo.funcionario_id, rita.funcionario_id);
        assert.equal(corpo.id, rita.id);
        assert.notEqual(corpo.id, corpo.funcionario_id, 'a fixture separa usuário e funcionário de propósito');
    });

    it('o nome vem do cadastro atual do funcionário, não do que o token carregava', async () => {
        const token = await entrar('caio@alfa.exemplo.invalid');
        await pool.query('UPDATE funcionarios SET nome = ? WHERE id = ?', ['Caio Renomeado Ficticio', ids['caio@alfa.exemplo.invalid'].funcionario_id]);
        const { corpo } = await get(token);
        assert.equal(corpo.nome, 'Caio Renomeado Ficticio');
    });

    it('não expõe e-mail, senha nem hash', async () => {
        const { corpo } = await get(await entrar('dora@alfa.exemplo.invalid'));
        assert.deepEqual(Object.keys(corpo).sort(), ['avatar', 'empresa_id', 'empresa_nome', 'funcionario_id', 'id', 'nome', 'perfil']);
    });

    describe('toda credencial inválida é 401', () => {
        const assinar = (carga, opcoes = {}, segredo = process.env.JWT_SECRET) => jwt.sign(carga, segredo, opcoes);
        const casos = {
            'sem cabeçalho': () => undefined,
            'token que não é JWT': () => 'lixo',
            'assinado com outro segredo': () => assinar({ id: 1 }, {}, 'outro-segredo-ficticio'),
            'expirado': () => assinar({ id: 1 }, { expiresIn: -60 }),
        };
        for (const [nome, criar] of Object.entries(casos)) {
            it(nome, async () => {
                const { status, corpo } = await get(criar());
                assert.equal(status, 401);
                assert.ok(corpo.erro);
            });
        }
    });

    it('usuário removido do banco perde a sessão, mesmo com token ainda válido', async () => {
        const token = await entrar('eva@beta.exemplo.invalid');
        await pool.query('DELETE FROM usuarios WHERE email = ?', ['eva@beta.exemplo.invalid']);
        const { status } = await get(token);
        assert.equal(status, 401);
    });
});
