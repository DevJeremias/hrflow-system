// O ponto de entrada de verdade: server.ts roda como processo, escuta a porta, responde às rotas de
// monitoramento e encerra limpo com SIGTERM, como o orquestrador pede. Banco e variáveis em
// tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST o teste é pulado.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import * as banco from './support/bancoDeTeste.ts';

const RAIZ = new URL('..', import.meta.url);
const PRAZO_MS = 15_000;

describe('server.ts', { skip: banco.skip }, () => {
    let processo: ChildProcess;
    let baseUrl: string;
    let saida = '';
    let encerrado: Promise<{ codigo: number | null; sinal: NodeJS.Signals | null }>;

    before(async () => {
        await banco.preparar();
        // PORT=0 deixa o sistema escolher uma porta livre; o servidor informa qual no log de partida (o log
        // sai com LOG_LEVEL=info: bancoDeTeste o silencia nos testes).
        processo = spawn(process.execPath, ['server.ts'], { cwd: RAIZ, env: { ...process.env, PORT: '0', LOG_LEVEL: 'info' }, stdio: ['ignore', 'pipe', 'inherit'] });
        encerrado = new Promise((resolve) => processo.on('exit', (codigo, sinal) => resolve({ codigo, sinal })));
        const porta = await new Promise<string>((resolve, rejeitar) => {
            const prazo = setTimeout(() => rejeitar(new Error(`server.ts não informou a porta em ${PRAZO_MS} ms:\n${saida}`)), PRAZO_MS);
            processo.stdout?.on('data', (parte: Buffer) => {
                saida += parte.toString();
                const achou = saida.match(/porta (\d+)/);
                if (achou) {
                    clearTimeout(prazo);
                    resolve(achou[1]);
                }
            });
            processo.on('exit', () => rejeitar(new Error(`server.ts encerrou antes de escutar:\n${saida}`)));
        });
        baseUrl = `http://127.0.0.1:${porta}`;
    });

    after(async () => {
        if (processo && processo.exitCode === null && processo.signalCode === null) processo.kill('SIGKILL');
        await banco.encerrar();
    });

    it('responde ao health e ao ready, que consulta o banco', async () => {
        const health = await fetch(`${baseUrl}/api/health`);
        assert.equal(health.status, 200);
        assert.deepEqual(await health.json(), { status: 'ok' });

        const ready = await fetch(`${baseUrl}/api/ready`);
        assert.equal(ready.status, 200);
        assert.deepEqual(await ready.json(), { status: 'ok' });
    });

    it('serve o app inteiro: rota protegida sem sessão é 401 e rota inexistente é 404 em JSON', async () => {
        assert.equal((await fetch(`${baseUrl}/api/funcionarios`)).status, 401);
        const inexistente = await fetch(`${baseUrl}/api/nao-existe`);
        assert.equal(inexistente.status, 404);
        assert.deepEqual(await inexistente.json(), { erro: 'Rota não encontrada.' });
    });

    it('testa a conexão com o banco na partida', async () => {
        const inicio = Date.now();
        while (!saida.includes('Conexão testada e funcionando') && Date.now() - inicio < 5000) {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        assert.match(saida, /Conexão testada e funcionando/);
    });

    it('encerra com código 0 ao receber SIGTERM, sem esperar conexão ociosa', async () => {
        processo.kill('SIGTERM');
        let prazo: NodeJS.Timeout | undefined;
        try {
            const resultado = await Promise.race([
                encerrado,
                new Promise<never>((_, rejeitar) => { prazo = setTimeout(() => rejeitar(new Error('server.ts não encerrou após o SIGTERM')), PRAZO_MS); }),
            ]);
            assert.deepEqual(resultado, { codigo: 0, sinal: null });
        } finally {
            clearTimeout(prazo);
        }
    });
});
