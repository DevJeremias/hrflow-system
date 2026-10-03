// Dados legais da empresa (razão social, CNPJ, regime tributário): o que o holerite imprime.
// MySQL real e descartável (tests/support/bancoDeTeste.ts); sem HRFLOW_TEST_DB_HOST o teste é pulado.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import { criarEmpresa, criarColaborador, cnpjDeTeste, novoCnpj } from './support/empresas.ts';
import pool from '../shared/db/pool.ts';
import authMiddleware from '../shared/middlewares/authMiddleware.ts';
import tratarErros from '../shared/middlewares/tratarErros.ts';
import { empresaRoutes } from '../modules/empresa/index.ts';
import { normalizarCnpj } from '../modules/empresa/empresa.regras.ts';

describe('validação do CNPJ', () => {
    it('aceita CNPJ com ou sem pontuação e devolve só os dígitos', () => {
        assert.equal(normalizarCnpj('11.222.333/0001-81'), '11222333000181');
        assert.equal(normalizarCnpj('11222333000181'), '11222333000181');
        assert.equal(normalizarCnpj(' 11 222 333 0001 81 '), '11222333000181');
        assert.equal(normalizarCnpj(cnpjDeTeste(12345)), cnpjDeTeste(12345));
    });

    it('recusa dígito verificador errado, tamanho errado, repetição e texto', () => {
        for (const invalido of ['11.222.333/0001-82', '11.222.333/0001-8', '112223330001810', '00000000000000', '11111111111111', 'abcdefghijklmn', '']) {
            assert.equal(normalizarCnpj(invalido), null, invalido);
        }
    });

    it('o CNPJ de teste que a suíte gera é sempre válido', () => {
        for (let numero = 1; numero <= 500; numero += 1) assert.notEqual(normalizarCnpj(cnpjDeTeste(numero)), null, String(numero));
    });
});

describe('dados da empresa', { skip: banco.skip }, () => {
    let server: http.Server, baseUrl: string;

    const chamar = async (metodo: string, token: string, corpo?: unknown) => {
        const resposta = await fetch(`${baseUrl}/api/empresa`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        return { status: resposta.status, corpo: await resposta.json() };
    };

    const cenario = async () => {
        const empresa = await criarEmpresa(pool, { comDadosLegais: false });
        const admin = (await criarUsuario(pool, { empresaId: empresa.empresaId, perfil: 'Administrador' })).token;
        const rh = (await criarUsuario(pool, { empresaId: empresa.empresaId, perfil: 'RH' })).token;
        const colaborador = (await criarColaborador(pool, empresa.empresaId, { nome: 'Colaborador Ficticio', salario: 3000 })).token;
        return { ...empresa, admin, rh, colaborador };
    };

    before(async () => {
        await banco.preparar();
        const app = express();
        app.use(express.json());
        app.use('/api/empresa', authMiddleware, empresaRoutes);
        app.use(tratarErros);
        server = http.createServer(app);
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    after(async () => {
        if (server) await new Promise((resolve) => server.close(resolve));
        await pool.end();
        await banco.encerrar();
    });

    it('empresa nova nasce sem dados legais, e o Administrador e o RH os leem', async () => {
        const { admin, rh } = await cenario();
        for (const token of [admin, rh]) {
            const { status, corpo } = await chamar('GET', token);
            assert.equal(status, 200);
            assert.deepEqual(Object.keys(corpo).sort(), ['cnpj', 'nome', 'razao_social', 'regime_tributario']);
            assert.equal(corpo.cnpj, null);
            assert.equal(corpo.razao_social, null);
            assert.equal(corpo.regime_tributario, null);
        }
    });

    it('o Administrador grava razão social, CNPJ (só dígitos) e regime, e a leitura os devolve', async () => {
        const { admin, rh } = await cenario();
        const cnpj = novoCnpj();
        const formatado = `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
        const salvo = await chamar('PUT', admin, { razao_social: '  Razao Social Ficticia Ltda  ', cnpj: formatado, regime_tributario: 'Lucro Presumido' });
        assert.equal(salvo.status, 200);
        assert.equal(salvo.corpo.razao_social, 'Razao Social Ficticia Ltda');
        assert.equal(salvo.corpo.cnpj, cnpj);
        assert.equal(salvo.corpo.regime_tributario, 'Lucro Presumido');
        assert.deepEqual((await chamar('GET', rh)).corpo, salvo.corpo);
    });

    it('o regime tributário é opcional e pode ser limpo', async () => {
        const { admin } = await cenario();
        const cnpj = novoCnpj();
        await chamar('PUT', admin, { razao_social: 'Razao Ficticia Ltda', cnpj, regime_tributario: 'Lucro Real' });
        const limpo = await chamar('PUT', admin, { razao_social: 'Razao Ficticia Ltda', cnpj, regime_tributario: '' });
        assert.equal(limpo.status, 200);
        assert.equal(limpo.corpo.regime_tributario, null);
    });

    it('só o Administrador altera: RH e colaborador recebem 403 e nada muda', async () => {
        const { admin, rh, colaborador } = await cenario();
        const corpo = { razao_social: 'Razao Ficticia Ltda', cnpj: novoCnpj() };
        assert.equal((await chamar('PUT', rh, corpo)).status, 403);
        assert.equal((await chamar('PUT', colaborador, corpo)).status, 403);
        assert.equal((await chamar('GET', colaborador)).status, 403);
        assert.equal((await chamar('GET', admin)).corpo.cnpj, null);
    });

    it('recusa CNPJ inválido, razão social vazia, regime desconhecido e campo extra com 400', async () => {
        const { admin } = await cenario();
        const valido = { razao_social: 'Razao Ficticia Ltda', cnpj: novoCnpj() };
        const casos: [string, Record<string, unknown>, RegExp][] = [
            ['CNPJ com dígito errado', { ...valido, cnpj: '11.222.333/0001-82' }, /CNPJ inválido/],
            ['CNPJ ausente', { razao_social: valido.razao_social }, /CNPJ é obrigatório/],
            ['razão social vazia', { ...valido, razao_social: '   ' }, /Razão social é obrigatório/],
            ['razão social longa', { ...valido, razao_social: 'x'.repeat(256) }, /no máximo 255/],
            ['regime desconhecido', { ...valido, regime_tributario: 'MEI' }, /Regime tributário deve ser/],
            ['campo fora do formato', { ...valido, fuso: 'America/Manaus' }, /Campo desconhecido: fuso/],
        ];
        for (const [nome, corpo, mensagem] of casos) {
            const { status, corpo: resposta } = await chamar('PUT', admin, corpo);
            assert.equal(status, 400, nome);
            assert.match(resposta.erro, mensagem, nome);
        }
        assert.equal((await chamar('GET', admin)).corpo.cnpj, null, 'nada foi gravado');
    });

    it('o CNPJ é único entre empresas: a segunda recebe 409, a primeira segue intacta', async () => {
        const alfa = await cenario();
        const beta = await cenario();
        const cnpj = novoCnpj();
        assert.equal((await chamar('PUT', alfa.admin, { razao_social: 'Alfa Ficticia Ltda', cnpj })).status, 200);
        const duplicado = await chamar('PUT', beta.admin, { razao_social: 'Beta Ficticia Ltda', cnpj });
        assert.equal(duplicado.status, 409);
        assert.match(duplicado.corpo.erro, /CNPJ já está cadastrado/);
        assert.equal((await chamar('GET', alfa.admin)).corpo.razao_social, 'Alfa Ficticia Ltda');
        assert.equal((await chamar('GET', beta.admin)).corpo.cnpj, null);
    });

    it('cada Administrador altera só a empresa do próprio token', async () => {
        const alfa = await cenario();
        const beta = await cenario();
        await chamar('PUT', beta.admin, { razao_social: 'Isolada Beta Ficticia Ltda', cnpj: novoCnpj() });
        await chamar('PUT', alfa.admin, { razao_social: 'Isolada Alfa Ficticia Ltda', cnpj: novoCnpj() });
        assert.equal((await chamar('GET', beta.admin)).corpo.razao_social, 'Isolada Beta Ficticia Ltda');
        assert.equal((await chamar('GET', alfa.admin)).corpo.razao_social, 'Isolada Alfa Ficticia Ltda');
    });

    it('sem sessão a API responde 401', async () => {
        assert.equal((await chamar('GET', '')).status, 401);
    });

    it('o banco guarda o fuso padrão de Belém e recusa CNPJ malformado', async () => {
        const { empresaId } = await cenario();
        const [[empresa]] = await pool.query<RowDataPacket[]>('SELECT fuso FROM empresas WHERE id = ?', [empresaId]);
        assert.equal(empresa.fuso, 'America/Belem');
        await assert.rejects(
            pool.query("UPDATE empresas SET cnpj = '123' WHERE id = ?", [empresaId]),
            (erro: { code?: string }) => erro.code === 'ER_CHECK_CONSTRAINT_VIOLATED'
        );
    });
});
