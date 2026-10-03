// H-14: deploy não corta requisição. O SIGTERM deixa a requisição em andamento terminar, fecha o servidor e o
// pool e sai em menos de 10 s; porta ocupada e DB_HOST vazio terminam o processo com código 1 e mensagem.
// Os testes do processo real usam o MySQL de tests/support/bancoDeTeste.ts.
import * as banco from './support/bancoDeTeste.ts';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { criarEncerramento } from '../shared/observabilidade/encerramento.ts';
import { criarLoggerCapturado } from './support/logCapturado.ts';

const RAIZ = path.join(import.meta.dirname, '..');

const portaLivre = () => new Promise<number>((resolve) => {
    const servidor = net.createServer().listen(0, '127.0.0.1', () => {
        const { port } = servidor.address() as net.AddressInfo;
        servidor.close(() => resolve(port));
    });
});

describe('encerramento ordenado', () => {
    const subir = async (tratar: http.RequestListener) => {
        const server = http.createServer(tratar);
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
        return { server, url: `http://127.0.0.1:${(server.address() as net.AddressInfo).port}` };
    };

    const montar = (server: http.Server, prazoMs?: number) => {
        const saidas: number[] = [];
        const eventos: string[] = [];
        const { logger } = criarLoggerCapturado();
        const encerrar = criarEncerramento({
            server,
            pool: { end: async () => { eventos.push('pool.end'); } },
            logger,
            prazoMs,
            sair: (codigo) => { saidas.push(codigo); eventos.push(`sair(${codigo})`); },
        });
        return { encerrar, saidas, eventos };
    };

    it('deixa a requisição em andamento terminar, só então fecha o pool e sai com 0', async () => {
        let chegou: () => void = () => {};
        const recebida = new Promise<void>((resolve) => { chegou = resolve; });
        const { server, url } = await subir((_req, res) => {
            chegou();
            setTimeout(() => res.end('terminou'), 300);
        });
        const { encerrar, saidas, eventos } = montar(server);

        const inicio = Date.now();
        const resposta = fetch(`${url}/lenta`);
        await recebida;
        const encerramento = encerrar('SIGTERM');

        const concluida = await resposta;
        assert.equal(concluida.status, 200);
        assert.equal(await concluida.text(), 'terminou', 'a requisição em andamento foi cortada');
        await encerramento;

        assert.deepEqual(eventos, ['pool.end', 'sair(0)']);
        assert.deepEqual(saidas, [0]);
        assert.ok(Date.now() - inicio < 10_000);
        await assert.rejects(fetch(`${url}/nova`), 'o servidor deve recusar conexões novas');
    });

    it('uma conexão keep-alive ociosa não segura o encerramento', async () => {
        const { server, url } = await subir((_req, res) => res.end('ok'));
        const { encerrar, saidas } = montar(server);
        const agente = new http.Agent({ keepAlive: true });
        await new Promise<void>((resolve) => http.get(`${url}/x`, { agent: agente }, (res) => res.resume().on('end', resolve)));

        const inicio = Date.now();
        await encerrar('SIGTERM');
        agente.destroy();
        assert.deepEqual(saidas, [0]);
        assert.ok(Date.now() - inicio < 2000, 'a conexão ociosa atrasou o encerramento');
    });

    it('passado o prazo, corta o que não terminou e sai com 1', async () => {
        let chegou: () => void = () => {};
        const recebida = new Promise<void>((resolve) => { chegou = resolve; });
        const { server, url } = await subir(() => chegou()); // nunca responde
        const { encerrar, saidas } = montar(server, 150);

        const resposta = fetch(`${url}/travada`).catch((erro) => erro);
        await recebida;
        void encerrar('SIGTERM');
        assert.ok((await resposta) instanceof Error, 'a conexão travada deveria ser cortada');
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.equal(saidas[0], 1);
    });

    it('chamar de novo (segundo sinal, falha durante o encerramento) não encerra duas vezes', async () => {
        const { server } = await subir((_req, res) => res.end());
        const { encerrar, saidas, eventos } = montar(server);
        await Promise.all([encerrar('SIGTERM'), encerrar('SIGINT'), encerrar('falha', 1)]);
        assert.deepEqual(saidas, [0]);
        assert.equal(eventos.filter((evento) => evento === 'pool.end').length, 1);
    });
});

describe('processo da API', { skip: banco.skip }, () => {
    before(banco.preparar);
    after(banco.encerrar);

    const subirProcesso = (env: Record<string, string>) => {
        const filho = spawn(process.execPath, ['server.ts'], {
            cwd: RAIZ,
            env: { ...process.env, ...banco.config.host ? {
                DB_HOST: banco.config.host,
                DB_PORT: String(banco.config.port ?? 3306),
                DB_USER: banco.config.user ?? '',
                DB_PASS: banco.config.password ?? '',
                DB_NAME: banco.config.database,
            } : {}, LOG_LEVEL: 'info', ...env },
        });
        let saida = '';
        const esperas: { regex: RegExp; resolver: () => void }[] = [];
        const ler = (pedaco: Buffer) => {
            saida += pedaco.toString();
            for (const espera of esperas.filter(({ regex }) => regex.test(saida))) espera.resolver();
        };
        filho.stdout.on('data', ler);
        filho.stderr.on('data', ler);
        const aguardar = (regex: RegExp) => new Promise<void>((resolve) => {
            if (regex.test(saida)) return resolve();
            esperas.push({ regex, resolver: resolve });
        });
        const termino = new Promise<{ codigo: number | null; sinal: NodeJS.Signals | null }>((resolve) => {
            filho.on('exit', (codigo, sinal) => resolve({ codigo, sinal }));
        });
        return { filho, aguardar, termino, saida: () => saida };
    };

    it('SIGTERM com uma requisição em andamento: ela termina e o processo sai com 0 em menos de 10 s', async () => {
        const porta = await portaLivre();
        const api = subirProcesso({ PORT: String(porta) });
        await api.aguardar(/Servidor rodando/);

        // Requisição em andamento de verdade: o corpo do login chega pela metade, e o servidor espera o resto.
        const corpo = JSON.stringify({ email: 'ninguem@exemplo.invalid', senha: 'senha-ficticia-1' });
        const socket = net.connect(porta, '127.0.0.1');
        let recebido = '';
        socket.on('data', (pedaco) => { recebido += pedaco.toString(); });
        await new Promise<void>((resolve) => socket.once('connect', resolve));
        socket.write(`POST /api/auth/login HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: ${corpo.length}\r\n\r\n${corpo.slice(0, 10)}`);
        await new Promise((resolve) => setTimeout(resolve, 300));

        const inicio = Date.now();
        api.filho.kill('SIGTERM');
        await new Promise((resolve) => setTimeout(resolve, 500));
        assert.equal(api.filho.exitCode, null, 'o processo saiu com a requisição ainda em andamento');
        assert.equal(recebido, '', 'a requisição em andamento já tinha sido respondida ou cortada');

        socket.write(corpo.slice(10));
        const { codigo } = await api.termino;
        socket.destroy();

        assert.match(recebido, /^HTTP\/1\.1 401 /, 'a requisição em andamento deveria terminar com a resposta normal');
        assert.equal(codigo, 0, api.saida());
        assert.ok(Date.now() - inicio < 10_000);
        assert.match(api.saida(), /encerrando/);
    });

    it('porta ocupada termina com código 1 e a mensagem', async () => {
        const ocupante = net.createServer().listen(0, '0.0.0.0');
        await new Promise((resolve) => ocupante.once('listening', resolve));
        const { port } = ocupante.address() as net.AddressInfo;
        try {
            const api = subirProcesso({ PORT: String(port) });
            const { codigo } = await api.termino;
            assert.equal(codigo, 1);
            assert.match(api.saida(), new RegExp(`Não foi possível abrir a porta ${port}`));
            assert.match(api.saida(), /EADDRINUSE/);
        } finally {
            ocupante.close();
        }
    });

    it('DB_HOST vazio impede a subida', async () => {
        const porta = await portaLivre();
        const api = subirProcesso({ PORT: String(porta), DB_HOST: '' });
        const { codigo } = await api.termino;
        assert.equal(codigo, 1);
        assert.match(api.saida(), /DB_HOST é obrigatória/);
        assert.doesNotMatch(api.saida(), /Servidor rodando/);
    });
});
