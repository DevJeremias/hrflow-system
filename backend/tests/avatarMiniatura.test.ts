// O avatar não trafega nas respostas: elas trazem a URL da miniatura de 128 px (GET /api/perfil/avatar).
// Exige um MySQL real (variáveis HRFLOW_TEST_DB_*, veja tests/support/bancoDeTeste.ts): sem ele os
// testes são marcados como ignorados, nunca como aprovados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import express from 'express';
import sharp from 'sharp';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import { dataUrl } from './support/imagens.ts';
import db from '../shared/db/pool.ts';
import authMiddleware from '../shared/middlewares/authMiddleware.ts';
import tratarErros from '../shared/middlewares/tratarErros.ts';
import { authRoutes } from '../modules/auth/index.ts';
import { perfilRoutes } from '../modules/perfil/index.ts';
import { TAMANHO_MAXIMO_BYTES } from '../modules/funcionarios/index.ts';

const LIMITE_DA_RESPOSTA = 10 * 1024;
const URL_DO_AVATAR = /^\/api\/perfil\/avatar\?v=\d+$/;

// Ruído não comprime: 700 x 700 x 3 bytes dá um PNG de cerca de 1,5 MB, a foto "pesada" do relatório.
const fotoPesada = async (): Promise<string> => {
    const png = await sharp(crypto.randomBytes(700 * 700 * 3), { raw: { width: 700, height: 700, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
    assert.ok(png.length > 1_000_000 && png.length < TAMANHO_MAXIMO_BYTES, `PNG de ${png.length} bytes`);
    return `data:image/png;base64,${png.toString('base64')}`;
};

describe('miniatura do avatar', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let baseUrl: string;
    let empresa: number;
    let funcionario: number;
    let pesada: string;
    const sessoes: Record<string, { id: number; token: string; email: string; nome: string }> = {};

    const chamar = async (metodo: string, caminho: string, quem: string, corpo?: unknown, cabecalhos: Record<string, string> = {}) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(sessoes[quem].token), ...cabecalhos },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        const bytes = Buffer.from(await resposta.arrayBuffer());
        return { status: resposta.status, bytes, cabecalhos: resposta.headers, json: () => JSON.parse(bytes.toString('utf8')) };
    };
    const salvar = (quem: string, avatar?: string | null) => chamar('PUT', '/api/perfil/meus-dados', quem, {
        nome: sessoes[quem].nome, email: sessoes[quem].email, telefone: '', ...(avatar === undefined ? {} : { avatar }),
    });
    const urlNaSessao = async (quem: string): Promise<string | null> => (await chamar('GET', '/api/auth/sessao', quem)).json().avatar;
    const linha = async (id: number): Promise<RowDataPacket> =>
        (await db.query<RowDataPacket[]>('SELECT avatar, avatar_miniatura, avatar_atualizado_em FROM usuarios WHERE id = ?', [id]))[0][0];

    before(async () => {
        await banco.preparar();

        const app = express();
        app.use('/api/auth', authRoutes);
        app.use(express.json({ limit: '4mb' }));
        app.use('/api/perfil', authMiddleware, perfilRoutes);
        app.use(tratarErros);
        servidor = http.createServer(app);
        await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

        empresa = (await db.query<ResultSetHeader>('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Ficticia']))[0].insertId;
        funcionario = (await db.query<ResultSetHeader>('INSERT INTO funcionarios (nome, email, empresa_id) VALUES (?, ?, ?)',
            ['Colaborador Avatar', 'colaborador.avatar@exemplo.invalid', empresa]))[0].insertId;
        for (const [quem, perfil, vinculo] of [['admin', 'Administrador', null], ['colaborador', 'Colaborador', funcionario], ['outro', 'RH', null]] as const) {
            const { usuario, token } = await criarUsuario(db, { empresaId: empresa, perfil, funcionarioId: vinculo });
            sessoes[quem] = { id: usuario.id, token, email: usuario.email, nome: usuario.nome };
        }
        pesada = await fotoPesada();
    });

    after(async () => {
        await new Promise((resolve) => servidor?.close(resolve));
        await db.end();
        await banco.encerrar();
    });

    it('sem avatar a sessão traz null e a miniatura responde 404 em JSON', async () => {
        assert.equal(await urlNaSessao('outro'), null);
        const resposta = await chamar('GET', '/api/perfil/avatar', 'outro');
        assert.equal(resposta.status, 404);
        assert.match(resposta.json().erro, /avatar/i);
    });

    it('a miniatura exige sessão', async () => {
        const resposta = await fetch(`${baseUrl}/api/perfil/avatar`);
        assert.equal(resposta.status, 401);
    });

    it('com uma foto de 1,5 MB gravada, sessão e perfil respondem com menos de 10 kB e só com a URL', async () => {
        assert.equal((await salvar('admin', pesada)).status, 200);

        const sessao = await chamar('GET', '/api/auth/sessao', 'admin');
        assert.ok(sessao.bytes.length < LIMITE_DA_RESPOSTA, `${sessao.bytes.length} bytes`);
        assert.match(sessao.json().avatar, URL_DO_AVATAR);

        const perfil = await chamar('GET', '/api/perfil/meus-dados', 'admin');
        assert.ok(perfil.bytes.length < LIMITE_DA_RESPOSTA, `${perfil.bytes.length} bytes`);
        assert.equal(perfil.json().avatar, sessao.json().avatar);
        assert.ok(!perfil.bytes.toString().includes('base64'));
    });

    it('serve uma miniatura WebP de 128 x 128 com ETag e responde 304 à revalidação', async () => {
        const resposta = await chamar('GET', '/api/perfil/avatar', 'admin');
        assert.equal(resposta.status, 200);
        assert.equal(resposta.cabecalhos.get('content-type'), 'image/webp');
        assert.match(resposta.cabecalhos.get('cache-control') ?? '', /private/);
        assert.match(resposta.cabecalhos.get('cache-control') ?? '', /no-cache/);
        const { width, height, format } = await sharp(resposta.bytes).metadata();
        assert.deepEqual({ width, height, format }, { width: 128, height: 128, format: 'webp' });
        assert.ok(resposta.bytes.length < LIMITE_DA_RESPOSTA);

        const etag = resposta.cabecalhos.get('etag');
        assert.ok(etag);
        const revalidada = await chamar('GET', '/api/perfil/avatar', 'admin', undefined, { 'If-None-Match': etag, 'Cache-Control': 'max-age=0' });
        assert.equal(revalidada.status, 304);
        assert.equal(revalidada.bytes.length, 0);
    });

    it('guarda o original e a miniatura, e o colaborador também no cadastro do funcionário', async () => {
        const antes = await linha(sessoes.admin.id);
        assert.equal(antes.avatar, pesada);
        assert.ok(antes.avatar_miniatura.length > 0);
        assert.ok(antes.avatar_atualizado_em);

        await salvar('colaborador', pesada);
        const [[cadastro]] = await db.query<RowDataPacket[]>('SELECT avatar FROM funcionarios WHERE id = ?', [funcionario]);
        assert.equal(cadastro.avatar, pesada);
        assert.match(await urlNaSessao('colaborador') ?? '', URL_DO_AVATAR);
    });

    it('salvar sem o campo avatar mantém a foto; "" remove foto e miniatura', async () => {
        const url = await urlNaSessao('admin');
        assert.equal((await salvar('admin')).status, 200);
        assert.equal(await urlNaSessao('admin'), url);
        assert.equal((await chamar('GET', '/api/perfil/avatar', 'admin')).status, 200);

        assert.equal((await salvar('admin', '')).status, 200);
        assert.equal(await urlNaSessao('admin'), null);
        assert.equal((await chamar('GET', '/api/perfil/avatar', 'admin')).status, 404);
        const depois = await linha(sessoes.admin.id);
        assert.equal(depois.avatar, null);
        assert.equal(depois.avatar_miniatura, null);
        assert.equal(depois.avatar_atualizado_em, null);

        await salvar('colaborador', null);
        const [[cadastro]] = await db.query<RowDataPacket[]>('SELECT avatar FROM funcionarios WHERE id = ?', [funcionario]);
        assert.equal(cadastro.avatar, null, 'null também remove');
    });

    it('uma foto nova troca a miniatura e a versão da URL', async () => {
        await salvar('admin', pesada);
        const primeira = await urlNaSessao('admin');
        const bytesAntes = (await chamar('GET', '/api/perfil/avatar', 'admin')).bytes;

        await salvar('admin', await fotoPesada());
        const segunda = await urlNaSessao('admin');
        assert.notEqual(segunda, primeira);
        assert.ok(!(await chamar('GET', '/api/perfil/avatar', 'admin')).bytes.equals(bytesAntes));
    });

    it('recorta imagens retangulares em quadrado', async () => {
        const larga = await sharp({ create: { width: 400, height: 100, channels: 3, background: '#336699' } }).png().toBuffer();
        assert.equal((await salvar('outro', `data:image/png;base64,${larga.toString('base64')}`)).status, 200);
        const { width, height } = await sharp((await chamar('GET', '/api/perfil/avatar', 'outro')).bytes).metadata();
        assert.deepEqual([width, height], [128, 128]);
    });

    it('gera a miniatura na primeira leitura para quem só tem o original (avatar anterior à miniatura)', async () => {
        const [{ id }] = [sessoes.colaborador];
        const original = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#aa3366' } }).jpeg().toBuffer();
        await db.query('UPDATE usuarios SET avatar = ?, avatar_miniatura = NULL, avatar_atualizado_em = NULL WHERE id = ?',
            [`data:image/jpeg;base64,${original.toString('base64')}`, id]);

        assert.match(await urlNaSessao('colaborador') ?? '', /^\/api\/perfil\/avatar\?v=0$/);
        const resposta = await chamar('GET', '/api/perfil/avatar', 'colaborador');
        assert.equal(resposta.status, 200);
        const { width, height } = await sharp(resposta.bytes).metadata();
        assert.deepEqual([width, height], [128, 128]);
        assert.ok((await linha(id)).avatar_miniatura.equals(resposta.bytes), 'a miniatura ficou guardada');
    });

    it('um original ilegível devolve 404 na miniatura em vez de erro 500', async () => {
        await db.query('UPDATE usuarios SET avatar = ?, avatar_miniatura = NULL WHERE id = ?', [dataUrl('png', 64), sessoes.colaborador.id]);
        assert.equal((await chamar('GET', '/api/perfil/avatar', 'colaborador')).status, 404);
    });

    it('recusa com 400, sem gravar nada, uma imagem que tem a assinatura mas não decodifica', async () => {
        await salvar('outro', '');
        const resposta = await salvar('outro', dataUrl('png', 64));
        assert.equal(resposta.status, 400);
        assert.match(resposta.json().erro, /imagem/i);
        assert.equal((await linha(sessoes.outro.id)).avatar, null);
    });

    it('cada pessoa lê só a própria miniatura', async () => {
        await salvar('admin', pesada);
        await salvar('outro', '');
        assert.equal((await chamar('GET', '/api/perfil/avatar', 'outro')).status, 404);
        assert.equal((await chamar('GET', '/api/perfil/avatar', 'admin')).status, 200);
    });
});
