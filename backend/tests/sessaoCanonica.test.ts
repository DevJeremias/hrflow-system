// SEC-08 (lado do servidor): GET /api/auth/sessao responde "quem sou eu" com perfil e vínculo,
// lidos do banco, e todo token inválido ou expirado é 401, que o front-end trata em um só lugar.
// Banco e variáveis em tests/support/bancoDeTeste.js; sem HRFLOW_TEST_DB_HOST o teste é pulado.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2/promise';
import banco from './support/bancoDeTeste.js';
import { cabecalhosDaSessao, tokenDaResposta } from './support/sessao.js';
import pool from '../config/db.js';
import { carregarFixtures } from '../seeds/fixtures.js';
import { authRoutes } from '../modules/auth/index.ts';
import { pararServidor, subirServidor } from './support/servidor.ts';

const SENHA = 'senha-ficticia-1';

describe('sessão canônica (GET /api/auth/sessao)', { skip: banco.skip }, () => {
    let server: http.Server;
    let baseUrl: string;
    const ids: Record<string, RowDataPacket> = {};

    const get = async (token: string | undefined) => {
        const resposta = await fetch(`${baseUrl}/api/auth/sessao`, { headers: cabecalhosDaSessao(token) });
        return { status: resposta.status, corpo: await resposta.json() };
    };

    const entrar = async (email: string) => {
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
        await carregarFixtures(pool, { senha: SENHA });
        const [usuarios] = await pool.query<RowDataPacket[]>('SELECT id, email, perfil, funcionario_id, empresa_id FROM usuarios');
        for (const u of usuarios) ids[u.email] = u;

        const app = express();
        app.use('/api/auth', authRoutes);
        ({ server, baseUrl } = await subirServidor(app));
    });

    after(async () => {
        if (server) await pararServidor(server);
        await pool.end();
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
        const assinar = (carga: object, opcoes: jwt.SignOptions = {}, segredo = process.env.JWT_SECRET as string) => jwt.sign(carga, segredo, opcoes);
        const casos: Record<string, () => string | undefined> = {
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
