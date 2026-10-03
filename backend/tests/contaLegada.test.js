// Contas criadas antes da troca de bcryptjs por bcrypt nativo guardam hashes $2b$ (gerados pelo
// bcryptjs 3) ou $2a$ (bibliotecas mais antigas). Os dois formatos precisam continuar entrando.
// Os hashes abaixo são literais gerados pelas bibliotecas originais, não pelo bcrypt em uso.
// Banco e variáveis em tests/support/bancoDeTeste.js; sem HRFLOW_TEST_DB_HOST os testes são pulados.
const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const banco = require('./support/bancoDeTeste');
const { criarUsuario, tokenDaResposta } = require('./support/sessao');

const SENHA = 'senha-legada-ficticia';
const HASH_BCRYPTJS_2B = '$2b$10$RCdzwpKK.eQPnNLbn53EkeZu3B6XsI5PPKl91m5zI0BzwKpMnfgCm';
const HASH_LEGADO_2A = '$2a$10$nzouARU.6dLcjtB5SzC58e0bxO./MFEu49wWaU7UKMaqixVY8e5X6';

describe('login de conta com hash legado', { skip: banco.skip }, () => {
    let server, baseUrl, pool, empresaId;

    const entrar = (email, senha) => fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
    });

    before(async () => {
        await banco.preparar();
        pool = require('../config/db');
        const [empresa] = await pool.query("INSERT INTO empresas (nome) VALUES ('Empresa Ficticia')");
        empresaId = empresa.insertId;

        const express = require('express');
        const app = express();
        app.use('/api/auth', require('../routes/authRoutes').criarRouter({
            loginPorIp: { windowMs: 60_000, limit: 1000 },
            loginPorIdentidade: { windowMs: 60_000, limit: 1000 },
            registroPorIp: { windowMs: 60_000, limit: 1000 },
            registroPorIdentidade: { windowMs: 60_000, limit: 1000 },
        }));
        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(async () => {
        if (server) await new Promise((resolve) => server.close(resolve));
        if (pool) await pool.end();
        await banco.encerrar();
    });

    for (const [formato, hash] of [['$2b$ do bcryptjs', HASH_BCRYPTJS_2B], ['$2a$', HASH_LEGADO_2A]]) {
        it(`conta com hash ${formato} entra com a senha certa e é recusada com a errada`, async () => {
            const { usuario } = await criarUsuario(pool, { empresaId, perfil: 'Administrador', senhaHash: hash });

            const certa = await entrar(usuario.email, SENHA);
            assert.equal(certa.status, 200);
            assert.ok(tokenDaResposta(certa), 'cookie de sessão ausente');

            const errada = await entrar(usuario.email, 'outra-senha-ficticia');
            assert.equal(errada.status, 401);
        });
    }
});
