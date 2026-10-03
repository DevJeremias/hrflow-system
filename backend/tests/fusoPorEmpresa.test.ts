// Cada empresa tem o seu fuso (empresas.fuso): o "dia" do ponto, o "hoje" do dashboard e o limite da
// justificativa seguem o relógio dela, não o de Belém. O relógio do servidor é fixado perto da virada
// do dia. MySQL real e descartável (tests/support/bancoDeTeste.ts); sem HRFLOW_TEST_DB_HOST o teste é pulado.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import * as banco from './support/bancoDeTeste.ts';
import { criarColaborador, criarEmpresa } from './support/empresas.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import { subirServidor, pararServidor } from './support/servidor.ts';
import db from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import { relogio } from '../shared/utils/fuso.ts';

// 00:30 de 11/03 em Belém (UTC-3) e 23:30 de 10/03 em Manaus (UTC-4).
const MEIA_NOITE_DE_BELEM = '2026-03-11T03:30:00Z';
// Uma hora depois: 00:30 de 11/03 em Manaus.
const MEIA_NOITE_DE_MANAUS = '2026-03-11T04:30:00Z';

describe('fuso por empresa', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let baseUrl: string;
    const belem = {} as { colaborador: number; token: string; admin: string };
    const manaus = {} as { colaborador: number; token: string; admin: string };

    const hora = (iso: string) => { relogio.agora = () => Date.parse(iso); };
    const chamar = async (metodo: string, caminho: string, token: string, corpo?: unknown) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        const texto = await resposta.text();
        return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
    };

    const cenario = async (zona: string) => {
        const { empresaId } = await criarEmpresa(db);
        await db.query('UPDATE empresas SET fuso = ? WHERE id = ?', [zona, empresaId]);
        const colaborador = await criarColaborador(db, empresaId, { nome: `Pessoa ${zona}`, salario: 3000, admissao: '2024-01-02' });
        const admin = await criarUsuario(db, { empresaId, perfil: 'Administrador' });
        return { colaborador: colaborador.funcionarioId, token: colaborador.token, admin: admin.token };
    };

    before(async () => {
        await banco.preparar();
        const { server, baseUrl: url } = await subirServidor(criarApp());
        servidor = server;
        baseUrl = url;
        Object.assign(belem, await cenario('America/Belem'));
        Object.assign(manaus, await cenario('America/Manaus'));
    });

    afterEach(() => { relogio.agora = () => Date.now(); });

    after(async () => {
        await pararServidor(servidor);
        await db.end();
        await banco.encerrar();
    });

    it('a mesma marcação cai em dias diferentes conforme o fuso da empresa', async () => {
        hora(MEIA_NOITE_DE_BELEM);
        const emBelem = await chamar('POST', '/api/ponto/registrar', belem.token, { tipo: 'Entrada' });
        const emManaus = await chamar('POST', '/api/ponto/registrar', manaus.token, { tipo: 'Entrada' });
        assert.equal(emBelem.status, 201, JSON.stringify(emBelem.corpo));
        assert.equal(emManaus.status, 201, JSON.stringify(emManaus.corpo));
        assert.deepEqual([emBelem.corpo.date, emBelem.corpo.time], ['2026-03-11', '00:30:00']);
        assert.deepEqual([emManaus.corpo.date, emManaus.corpo.time], ['2026-03-10', '23:30:00']);

        const hojeEmManaus = await chamar('GET', `/api/ponto/hoje/${manaus.colaborador}`, manaus.token);
        assert.deepEqual(hojeEmManaus.corpo.map((r: { date: string }) => r.date), ['2026-03-10']);
    });

    it('a virada do dia de Manaus acontece uma hora depois: a sequência da marcação recomeça', async () => {
        hora(MEIA_NOITE_DE_BELEM);
        await chamar('POST', '/api/ponto/registrar', belem.token, { tipo: 'Saída' });
        await chamar('POST', '/api/ponto/registrar', manaus.token, { tipo: 'Saída' });

        hora(MEIA_NOITE_DE_MANAUS);
        // Em Belém o dia 11 já terminou a jornada com a Saída: não cabe outra Entrada.
        assert.equal((await chamar('POST', '/api/ponto/registrar', belem.token, { tipo: 'Entrada' })).status, 409);
        // Em Manaus o dia 11 começou agora: Entrada é a primeira marcação do dia.
        const novoDia = await chamar('POST', '/api/ponto/registrar', manaus.token, { tipo: 'Entrada' });
        assert.equal(novoDia.status, 201, JSON.stringify(novoDia.corpo));
        assert.equal(novoDia.corpo.date, '2026-03-11');
        const hoje = await chamar('GET', `/api/ponto/hoje/${manaus.colaborador}`, manaus.token);
        assert.deepEqual(hoje.corpo.map((r: { type: string }) => r.type), ['Entrada']);
    });

    it('o limite da justificativa é o hoje da empresa', async () => {
        hora(MEIA_NOITE_DE_BELEM);
        // 11/03 já começou em Belém, mas ainda é o futuro em Manaus.
        const emBelem = await chamar('PUT', '/api/ponto/justificativa/2026-03-11', belem.token, { texto: 'Consulta.' });
        const emManaus = await chamar('PUT', '/api/ponto/justificativa/2026-03-11', manaus.token, { texto: 'Consulta.' });
        assert.equal(emBelem.status, 200, JSON.stringify(emBelem.corpo));
        assert.equal(emManaus.status, 400, JSON.stringify(emManaus.corpo));
        assert.match(emManaus.corpo.erro, /Data da justificativa/);
    });

    it('o resumo do dashboard conta as marcações do dia da empresa', async () => {
        hora(MEIA_NOITE_DE_BELEM);
        // As duas marcações de cada empresa (testes anteriores) estão no "hoje" dela: o dia 11 em Belém e
        // o dia 10, que ainda corre, em Manaus.
        const resumoBelem = await chamar('GET', '/api/dashboard/resumo', belem.admin);
        const resumoManaus = await chamar('GET', '/api/dashboard/resumo', manaus.admin);
        assert.equal(resumoBelem.corpo.marcacoesHoje, 2, JSON.stringify(resumoBelem.corpo));
        assert.equal(resumoManaus.corpo.marcacoesHoje, 2, JSON.stringify(resumoManaus.corpo));

        hora(MEIA_NOITE_DE_MANAUS);
        assert.equal((await chamar('GET', '/api/dashboard/resumo', manaus.admin)).corpo.marcacoesHoje, 1);
    });

    it('a sessão informa o fuso da empresa ao front-end', async () => {
        const sessao = await chamar('GET', '/api/auth/sessao', manaus.admin);
        assert.equal(sessao.corpo.empresa_fuso, 'America/Manaus');
    });
});
