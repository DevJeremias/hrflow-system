// M-14: com o pool e a fila cheios, a API recusa o excesso com 503 e Retry-After, nunca com 500. O pool é
// reduzido (2 conexões, fila de 5) para 200 chamadas simultâneas esgotarem a fila de verdade no CI; em
// produção os limites são 10 e 50 (shared/db/pool.ts). Banco e variáveis em tests/support/bancoDeTeste.ts.
import * as banco from './support/bancoDeTeste.ts';
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import type { ResultSetHeader } from 'mysql2/promise';

const CONEXOES = 2;
const FILA = 5;
const CHAMADAS = 200;

// O pool lê os limites ao ser carregado.
process.env.DB_CONNECTION_LIMIT = String(CONEXOES);
process.env.DB_QUEUE_LIMIT = String(FILA);
const { default: pool, LIMITES_POOL } = await import('../shared/db/pool.ts');
const { criarApp } = await import('../app.ts');
const { cabecalhosDaSessao, criarUsuario } = await import('./support/sessao.ts');
const { pararServidor, subirServidor } = await import('./support/servidor.ts');

describe('carga na sessão', { skip: banco.skip }, () => {
    let server: http.Server;
    let baseUrl: string;
    let token: string;

    before(async () => {
        await banco.preparar();
        const [empresa] = await pool.query<ResultSetHeader>('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia Carga']);
        ({ token } = await criarUsuario(pool, { empresaId: empresa.insertId, perfil: 'Administrador' }));
        ({ server, baseUrl } = await subirServidor(criarApp()));
    });

    after(async () => {
        await pararServidor(server);
        await pool.end();
        await banco.encerrar();
    });

    it('o ambiente reduz o pool para o teste', () => {
        assert.equal(LIMITES_POOL.connectionLimit, CONEXOES);
        assert.equal(LIMITES_POOL.queueLimit, FILA);
    });

    it(`${CHAMADAS} chamadas simultâneas de /api/auth/sessao devolvem só 200 ou 503 com Retry-After, nunca 500`, async () => {
        // Segura todas as conexões por 1 s: a fila enche de forma determinística, sem depender da velocidade da
        // máquina. As ${FILA} primeiras chamadas esperam na fila e as demais são recusadas na hora.
        const ocupadas = Array.from({ length: CONEXOES }, () => pool.query('SELECT SLEEP(1)'));
        await new Promise((resolve) => setTimeout(resolve, 100));

        const respostas = await Promise.all(Array.from({ length: CHAMADAS }, () =>
            fetch(`${baseUrl}/api/auth/sessao`, { headers: cabecalhosDaSessao(token) })
                .then(async (resposta) => { await resposta.arrayBuffer(); return resposta; })));
        await Promise.all(ocupadas);

        const contagem = new Map<number, number>();
        for (const resposta of respostas) contagem.set(resposta.status, (contagem.get(resposta.status) ?? 0) + 1);
        const resumo = JSON.stringify(Object.fromEntries(contagem));

        for (const status of contagem.keys()) assert.ok(status === 200 || status === 503, `status inesperado: ${resumo}`);
        assert.ok((contagem.get(200) ?? 0) > 0, `nenhuma chamada foi atendida: ${resumo}`);
        assert.ok((contagem.get(503) ?? 0) > 0, `a fila nunca encheu, o teste não exercitou o limite: ${resumo}`);
        for (const resposta of respostas.filter((candidata) => candidata.status === 503)) {
            assert.ok(Number(resposta.headers.get('retry-after')) > 0, 'um 503 saiu sem Retry-After');
        }
    });

    it('depois da rajada o pool se recupera e atende normalmente', async () => {
        const resposta = await fetch(`${baseUrl}/api/auth/sessao`, { headers: cabecalhosDaSessao(token) });
        assert.equal(resposta.status, 200);
    });
});
