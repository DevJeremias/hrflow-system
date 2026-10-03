// A sessão vive em cookie HttpOnly e o token CSRF protege quem muda estado. O JavaScript da página
// nunca recebe o token: nem no corpo do login, nem em cookie legível. Banco e variáveis em
// tests/support/bancoDeTeste.js; sem HRFLOW_TEST_DB_HOST os testes de integração são pulados.
const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const banco = require('./support/bancoDeTeste');
const { criarUsuario, cabecalhosDaSessao, tokenDaResposta } = require('./support/sessao');
const { cookieSeguro, tokenCsrf, COOKIE_SESSAO, COOKIE_CSRF } = require('../utils/sessao');

const SENHA = 'senha-ficticia-1';

const cookieDe = (resposta, nome) => resposta.headers.getSetCookie().find((linha) => linha.startsWith(`${nome}=`));
// Sem o Expires que o Express acrescenta ao Max-Age, só para os navegadores antigos.
const atributos = (linha) => linha.split(';').slice(1).map((parte) => parte.trim().toLowerCase())
    .filter((atributo) => !atributo.startsWith('expires='));

describe('cookieSeguro', () => {
    const original = process.env.NODE_ENV;
    after(() => { process.env.NODE_ENV = original; });

    it('em HTTPS (inclusive atrás do proxy, onde req.secure vem de X-Forwarded-Proto) o cookie é Secure', () => {
        assert.equal(cookieSeguro({ secure: true, hostname: 'localhost' }), true);
    });

    it('em desenvolvimento, HTTP simples em localhost não é Secure', () => {
        process.env.NODE_ENV = 'development';
        assert.equal(cookieSeguro({ secure: false, hostname: 'localhost' }), false);
    });

    it('em produção só o loopback escapa do Secure, mesmo que o proxy não informe HTTPS', () => {
        process.env.NODE_ENV = 'production';
        assert.equal(cookieSeguro({ secure: false, hostname: 'hrflow.exemplo.invalid' }), true);
        assert.equal(cookieSeguro({ secure: false, hostname: '127.0.0.1' }), false);
    });
});

describe('sessão em cookie HttpOnly e proteção CSRF', { skip: banco.skip }, () => {
    let server, baseUrl, pool, empresaId;
    let email;
    let chamadasProtegidas = 0;

    const entrar = (cabecalhos = {}) => fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...cabecalhos },
        body: JSON.stringify({ email, senha: SENHA }),
    });

    const protegida = (metodo, cabecalhos) => fetch(`${baseUrl}/api/protegida`, { method: metodo, headers: cabecalhos });

    before(async () => {
        await banco.preparar();
        pool = require('../config/db');
        const bcrypt = require('bcrypt');
        const [empresa] = await pool.query("INSERT INTO empresas (nome) VALUES ('Empresa Ficticia')");
        empresaId = empresa.insertId;
        const { usuario } = await criarUsuario(pool, {
            empresaId, perfil: 'Administrador', senhaHash: await bcrypt.hash(SENHA, 4),
        });
        email = usuario.email;

        const express = require('express');
        const authMiddleware = require('../middlewares/authMiddleware');
        const app = express();
        app.set('trust proxy', 1);
        app.use('/api/auth', require('../routes/authRoutes').criarRouter({
            loginPorIp: { windowMs: 60_000, limit: 1000 },
            loginPorIdentidade: { windowMs: 60_000, limit: 1000 },
            registroPorIp: { windowMs: 60_000, limit: 1000 },
            registroPorIdentidade: { windowMs: 60_000, limit: 1000 },
        }));
        for (const metodo of ['get', 'post', 'put', 'patch', 'delete']) {
            app[metodo]('/api/protegida', authMiddleware, (req, res) => {
                chamadasProtegidas += 1;
                res.json({ id: req.usuario.id });
            });
        }
        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(async () => {
        if (server) await new Promise((resolve) => server.close(resolve));
        if (pool) await pool.end();
        await banco.encerrar();
    });

    describe('login', () => {
        it('entrega o token só em cookie HttpOnly, SameSite=Lax, com a duração de 8 horas', async () => {
            const resposta = await entrar();
            assert.equal(resposta.status, 200);

            const corpo = await resposta.json();
            assert.deepEqual(Object.keys(corpo).sort(), ['nome', 'perfil']);

            const sessao = cookieDe(resposta, COOKIE_SESSAO);
            assert.ok(sessao, 'cookie de sessão ausente');
            assert.deepEqual(atributos(sessao).sort(), ['httponly', 'max-age=28800', 'path=/', 'samesite=lax'].sort());
            assert.ok(!resposta.headers.getSetCookie().some((linha) => linha.includes('Secure')), 'HTTP puro não leva Secure');
        });

        it('o cookie de CSRF é legível pelo front-end e está atrelado à sessão', async () => {
            const resposta = await entrar();
            const csrf = cookieDe(resposta, COOKIE_CSRF);
            assert.ok(csrf);
            assert.ok(!atributos(csrf).includes('httponly'));
            assert.ok(atributos(csrf).includes('samesite=lax'));
            assert.ok(atributos(csrf).includes('max-age=28800'));
            assert.equal(csrf.split(';')[0], `${COOKIE_CSRF}=${tokenCsrf(tokenDaResposta(resposta))}`);
        });

        it('atrás do proxy com HTTPS os dois cookies são Secure', async () => {
            const resposta = await entrar({ 'X-Forwarded-Proto': 'https' });
            const linhas = resposta.headers.getSetCookie();
            assert.equal(linhas.length, 2);
            for (const linha of linhas) assert.ok(atributos(linha).includes('secure'), linha.split('=')[0]);
        });

        it('credencial inválida não cria sessão', async () => {
            const resposta = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha: 'senha-errada-ficticia' }),
            });
            assert.equal(resposta.status, 401);
            assert.deepEqual(resposta.headers.getSetCookie(), []);
        });
    });

    describe('autenticação por cookie', () => {
        it('aceita o cookie de sessão em leitura, sem token CSRF', async () => {
            const token = tokenDaResposta(await entrar());
            const resposta = await protegida('GET', { Cookie: `${COOKIE_SESSAO}=${token}` });
            assert.equal(resposta.status, 200);
        });

        it('não aceita mais o token em Authorization: Bearer', async () => {
            const token = tokenDaResposta(await entrar());
            const resposta = await protegida('GET', { Authorization: `Bearer ${token}` });
            assert.equal(resposta.status, 401);
        });

        it('sem cookie é 401', async () => {
            assert.equal((await protegida('GET', {})).status, 401);
        });

        it('token inválido é 401 e limpa os cookies', async () => {
            const resposta = await protegida('GET', cabecalhosDaSessao('lixo'));
            assert.equal(resposta.status, 401);
            assert.equal(resposta.headers.getSetCookie().length, 2);
            for (const linha of resposta.headers.getSetCookie()) assert.match(linha, /Expires=Thu, 01 Jan 1970/);
        });

        it('sessão revogada pela versão é 401 e limpa os cookies', async () => {
            const token = tokenDaResposta(await entrar());
            await pool.query('UPDATE usuarios SET sessao_versao = sessao_versao + 1 WHERE email = ?', [email]);
            const resposta = await protegida('GET', cabecalhosDaSessao(token));
            assert.equal(resposta.status, 401);
            assert.equal(resposta.headers.getSetCookie().length, 2);
        });
    });

    describe('CSRF em métodos que mudam estado', () => {
        for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE']) {
            it(`${metodo} com o cookie e sem o cabeçalho é recusado antes de chegar à rota`, async () => {
                const token = tokenDaResposta(await entrar());
                const antes = chamadasProtegidas;
                const resposta = await protegida(metodo, { Cookie: `${COOKIE_SESSAO}=${token}` });
                assert.equal(resposta.status, 403);
                assert.match((await resposta.json()).erro, /CSRF/);
                assert.equal(chamadasProtegidas, antes);
            });
        }

        it('token CSRF qualquer, ou de outra sessão, é recusado', async () => {
            const token = tokenDaResposta(await entrar());
            const { token: outro } = await criarUsuario(pool, { empresaId, perfil: 'Administrador' });
            for (const csrf of ['x', '', tokenCsrf(outro), `${tokenCsrf(token)}0`]) {
                const resposta = await protegida('POST', { Cookie: `${COOKIE_SESSAO}=${token}`, 'X-CSRF-Token': csrf });
                assert.equal(resposta.status, 403, `csrf=${csrf.slice(0, 8)}`);
            }
        });

        it('um cookie de CSRF forjado não vale: o servidor confere contra a sessão, não contra o cookie', async () => {
            const token = tokenDaResposta(await entrar());
            const resposta = await protegida('POST', {
                Cookie: `${COOKIE_SESSAO}=${token}; ${COOKIE_CSRF}=forjado`,
                'X-CSRF-Token': 'forjado',
            });
            assert.equal(resposta.status, 403);
        });

        for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE']) {
            it(`${metodo} com o token CSRF da sessão passa`, async () => {
                const token = tokenDaResposta(await entrar());
                const resposta = await protegida(metodo, cabecalhosDaSessao(token));
                assert.equal(resposta.status, 200);
            });
        }

        it('CSRF vale depois da validação da sessão: sem sessão continua 401, não 403', async () => {
            assert.equal((await protegida('POST', { 'X-CSRF-Token': 'x' })).status, 401);
        });
    });

    describe('logout', () => {
        it('limpa o cookie de sessão e o de CSRF com os mesmos atributos do login', async () => {
            const token = tokenDaResposta(await entrar());
            const resposta = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: cabecalhosDaSessao(token) });
            assert.equal(resposta.status, 204);

            const sessao = cookieDe(resposta, COOKIE_SESSAO);
            const csrf = cookieDe(resposta, COOKIE_CSRF);
            for (const linha of [sessao, csrf]) {
                assert.ok(linha, 'cookie não limpo');
                assert.ok(atributos(linha).includes('path=/'));
                assert.ok(atributos(linha).includes('samesite=lax'));
                assert.match(linha, /Expires=Thu, 01 Jan 1970/);
            }
            assert.ok(atributos(sessao).includes('httponly'));
        });

        it('funciona sem sessão: quem já expirou também consegue limpar os cookies', async () => {
            const resposta = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
            assert.equal(resposta.status, 204);
            assert.equal(resposta.headers.getSetCookie().length, 2);
        });
    });
});
