// Contas criadas antes da troca de bcryptjs por bcrypt nativo guardam hashes $2b$ (gerados pelo
// bcryptjs 3) ou $2a$ (bibliotecas mais antigas). Os dois formatos precisam continuar entrando.
// Os hashes abaixo são literais gerados pelas bibliotecas originais, não pelo bcrypt em uso.
// Banco e variáveis em tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST os testes são pulados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import type { ResultSetHeader } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, tokenDaResposta } from './support/sessao.ts';
import pool from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import { LIMITES_AUTH_FOLGADOS, pararServidor, subirServidor } from './support/servidor.ts';

const SENHA = 'senha-legada-ficticia';
const HASH_BCRYPTJS_2B = '$2b$10$RCdzwpKK.eQPnNLbn53EkeZu3B6XsI5PPKl91m5zI0BzwKpMnfgCm';
const HASH_LEGADO_2A = '$2a$10$nzouARU.6dLcjtB5SzC58e0bxO./MFEu49wWaU7UKMaqixVY8e5X6';

describe('login de conta com hash legado', { skip: banco.skip }, () => {
    let server: http.Server;
    let baseUrl: string;
    let empresaId: number;

    const entrar = (email: string, senha: string) => fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
    });

    before(async () => {
        await banco.preparar();
        const [empresa] = await pool.query<ResultSetHeader>("INSERT INTO empresas (nome) VALUES ('Empresa Ficticia')");
        empresaId = empresa.insertId;

        const app = criarApp({
            limitesAuth: LIMITES_AUTH_FOLGADOS,
        });
        ({ server, baseUrl } = await subirServidor(app));
    });

    after(async () => {
        if (server) await pararServidor(server);
        await pool.end();
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
