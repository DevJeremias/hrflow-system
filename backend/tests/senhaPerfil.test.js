// Regressão do B-08 (limites de autenticação): a troca de senha de /api/perfil/alterar-senha tem
// teto de tentativas por usuário e recusa uma senha nova igual à atual. Cada cenário roda de ponta
// a ponta contra o MySQL migrado (tests/support/bancoDeTeste.js); sem HRFLOW_TEST_DB_HOST os testes
// são marcados como ignorados, nunca como aprovados.
const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const bcrypt = require('bcryptjs');
const banco = require('./support/bancoDeTeste');
const { criarUsuario, cabecalhosDaSessao } = require('./support/sessao');

describe('troca de senha do perfil (B-08)', { skip: banco.skip }, () => {
    const senhaAtual = 'senha-atual-ficticia';
    let server, baseUrl, pool, empresa, hash;

    const trocar = async (token, corpo) => {
        const resposta = await fetch(`${baseUrl}/api/perfil/alterar-senha`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
            body: JSON.stringify(corpo),
        });
        return { status: resposta.status, retryAfter: resposta.headers.get('retry-after'), corpo: await resposta.json() };
    };

    const novoUsuario = () => criarUsuario(pool, { empresaId: empresa, perfil: 'Colaborador', senhaHash: hash });

    before(async () => {
        await banco.preparar();
        pool = require('../config/db');

        const express = require('express');
        const authMiddleware = require('../middlewares/authMiddleware');
        const app = express();
        app.use(express.json());
        app.use('/api/perfil', authMiddleware, require('../routes/perfilRoutes').criarRouter());
        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;

        [{ insertId: empresa }] = await pool.query("INSERT INTO empresas (nome) VALUES ('Empresa Senha Ficticia')");
        hash = await bcrypt.hash(senhaAtual, 4);
    });

    after(async () => {
        await new Promise((resolve) => server.close(resolve));
        await pool.end();
        await banco.encerrar();
    });

    it('devolve 429 na sexta tentativa com a senha atual errada', async () => {
        const { token } = await novoUsuario();
        for (let i = 1; i <= 5; i += 1) {
            const { status } = await trocar(token, { senhaAtual: 'senha-errada-ficticia', novaSenha: 'senha-nova-ficticia' });
            assert.equal(status, 400, `tentativa ${i}`);
        }
        const bloqueada = await trocar(token, { senhaAtual: 'senha-errada-ficticia', novaSenha: 'senha-nova-ficticia' });
        assert.equal(bloqueada.status, 429);
        assert.ok(Number(bloqueada.retryAfter) > 0);
        assert.ok(bloqueada.corpo.retryAfterSegundos > 0);

        // Nem a senha certa passa enquanto o bloqueio durar.
        assert.equal((await trocar(token, { senhaAtual, novaSenha: 'senha-nova-ficticia' })).status, 429);
    });

    it('o bloqueio é por usuário: a tentativa de outra pessoa não é afetada', async () => {
        const [alvo, outro] = [await novoUsuario(), await novoUsuario()];
        for (let i = 0; i < 6; i += 1) await trocar(alvo.token, { senhaAtual: 'senha-errada-ficticia', novaSenha: 'senha-nova-ficticia' });
        assert.equal((await trocar(alvo.token, { senhaAtual, novaSenha: 'senha-nova-ficticia' })).status, 429);
        assert.equal((await trocar(outro.token, { senhaAtual, novaSenha: 'senha-nova-ficticia' })).status, 200);
    });

    it('responde 400 quando a senha nova é igual à atual e não troca nada', async () => {
        const { token, usuario } = await novoUsuario();
        const { status, corpo } = await trocar(token, { senhaAtual, novaSenha: senhaAtual });
        assert.equal(status, 400);
        assert.match(corpo.erro, /diferente da atual/);

        const [[atual]] = await pool.query('SELECT senha, sessao_versao FROM usuarios WHERE id = ?', [usuario.id]);
        assert.equal(atual.senha, hash);
        assert.equal(atual.sessao_versao, usuario.sessao_versao);
    });
});
