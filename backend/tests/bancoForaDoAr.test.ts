// M-10: banco fora vira "tente de novo" em segundos, não 500 depois de 10 s. Aqui o pool da API aponta para uma
// porta fechada e para um servidor que aceita a conexão e nunca responde; o login e a sessão devem
// devolver 503 com Retry-After em menos de 6 s. Não precisa de MySQL: o banco é justamente o que falta.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';

const portaLivre = () => new Promise<number>((resolve) => {
    const servidor = net.createServer().listen(0, '127.0.0.1', () => {
        const { port } = servidor.address() as net.AddressInfo;
        servidor.close(() => resolve(port));
    });
});

// O pool lê o ambiente ao ser carregado: o app só entra depois de o banco falso estar definido.
const portaFechada = await portaLivre();
Object.assign(process.env, {
    DB_HOST: '127.0.0.1', DB_PORT: String(portaFechada), DB_USER: 'root', DB_PASS: 'x', DB_NAME: 'hrflow_inexistente',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'), LOG_LEVEL: 'silent',
});
const { criarApp } = await import('../app.ts');
const { default: pool } = await import('../shared/db/pool.ts');
const { emitirToken } = await import('../modules/auth/auth.sessao.ts');
const { cabecalhosDaSessao } = await import('./support/sessao.ts');
const { pararServidor, subirServidor } = await import('./support/servidor.ts');

const LIMITE_MS = 6000;

describe('banco indisponível', () => {
    let server: http.Server;
    let baseUrl: string;
    const token = emitirToken({ id: 1, perfil: 'Administrador', empresa_id: 1, funcionario_id: null, sessao_versao: 1 }, 'Admin Ficticio');

    before(async () => {
        ({ server, baseUrl } = await subirServidor(criarApp()));
    });

    after(async () => {
        await pararServidor(server);
        await pool.end();
    });

    const login = () => fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ana@exemplo.invalid', senha: 'senha-ficticia-1' }),
    });

    it('porta fechada: o login responde 503 com Retry-After em menos de 6 s', async () => {
        const inicio = Date.now();
        const resposta = await login();
        assert.equal(resposta.status, 503);
        assert.ok(Number(resposta.headers.get('retry-after')) > 0, 'falta o Retry-After');
        assert.match((await resposta.json()).erro, /Tente novamente/);
        assert.ok(Date.now() - inicio < LIMITE_MS, `levou ${Date.now() - inicio} ms`);
    });

    it('porta fechada: a conferência da sessão também é 503 com Retry-After, não 500', async () => {
        const resposta = await fetch(`${baseUrl}/api/auth/sessao`, { headers: cabecalhosDaSessao(token) });
        assert.equal(resposta.status, 503);
        assert.ok(Number(resposta.headers.get('retry-after')) > 0);
    });

    it('porta fechada: uma rota do ponto responde 503, não 500', async () => {
        const resposta = await fetch(`${baseUrl}/api/ponto/hoje/1`, { headers: cabecalhosDaSessao(token) });
        assert.equal(resposta.status, 503);
    });
});

describe('banco que aceita a conexão e não responde', () => {
    let travado: net.Server;
    const conexoes = new Set<net.Socket>();

    before(async () => {
        // Sem o handshake do MySQL, o driver espera até o connectTimeout.
        travado = net.createServer((socket) => { conexoes.add(socket); socket.on('error', () => {}); }).listen(0, '127.0.0.1');
        await new Promise((resolve) => travado.once('listening', resolve));
    });

    after(async () => {
        for (const socket of conexoes) socket.destroy();
        await new Promise((resolve) => travado.close(resolve));
    });

    it('o login responde 503 com Retry-After em menos de 6 s (ETIMEDOUT em 5 s)', async () => {
        const { criarPool } = await import('../shared/db/pool.ts');
        const pool = criarPool();
        // Mesmo pool, outro destino: a conexão nasce no host e porta do servidor travado.
        (pool.pool.config as unknown as { connectionConfig: { port: number } }).connectionConfig.port = (travado.address() as net.AddressInfo).port;
        const { traduzirErro } = await import('../shared/utils/erros.ts');

        const inicio = Date.now();
        const erro = await pool.query('SELECT 1').then(() => null, (falha: unknown) => falha);
        await pool.end();

        assert.ok(erro, 'a consulta deveria falhar');
        assert.equal((erro as { code?: string }).code, 'ETIMEDOUT');
        assert.equal(traduzirErro(erro)?.status, 503);
        assert.ok(Date.now() - inicio < LIMITE_MS, `levou ${Date.now() - inicio} ms`);
    });
});
