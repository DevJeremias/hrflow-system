// Departamentos e cargos devolvem os números reais (colaboradores, ocupantes, cargos), a sigla do
// setor em cada cargo, e a exclusão não revela nem toca registros de outra empresa.
//
// Exige um MySQL real (variáveis HRFLOW_TEST_DB_*, ver tests/support/bancoDeTeste.ts).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { RowDataPacket } from 'mysql2/promise';
// banco vem antes do pool, do authMiddleware e das fixtures: ele define as variáveis de ambiente
// que eles leem ao carregar.
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import pool from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import authMiddleware from '../shared/middlewares/authMiddleware.ts';
import { carregarFixtures } from '../shared/db/fixtures.ts';

interface Departamento extends RowDataPacket {
    id: number;
    sigla: string;
    total_colaboradores: number;
    colaboradores_ativos: number;
    total_cargos: number;
}

interface Cargo extends RowDataPacket {
    id: number;
    nome: string;
    departamento_id: number;
    departamento_sigla: string;
    departamento_nome: string;
    ocupantes: number;
}

describe('estrutura organizacional: contagens e exclusão', { skip: banco.skip }, () => {
    let server: http.Server | undefined;
    let baseUrl: string;
    let alfa: number;
    let beta: number;
    const tokens: Record<number, string> = {};

    const chamar = async (metodo: string, caminho: string, empresaId: number) => {
        const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json', ...(cabecalhosDaSessao(tokens[empresaId]) as Record<string, string>) };
        const resposta = await fetch(`${baseUrl}${caminho}`, { method: metodo, headers: cabecalhos });
        return { status: resposta.status, corpo: await resposta.json() as any };
    };

    before(async () => {
        await banco.preparar();
        await carregarFixtures(pool, { senha: 'senha-ficticia-123' });

        const app = criarApp();
        const servidor = http.createServer(app);
        server = servidor;
        await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

        const empresaDe = async (nome: string): Promise<number> => (await pool.query<RowDataPacket[]>('SELECT id FROM empresas WHERE nome = ?', [nome]))[0][0].id;
        alfa = await empresaDe('Empresa Ficticia Alfa Ltda');
        beta = await empresaDe('Empresa Ficticia Beta Ltda');
        for (const empresaId of [alfa, beta]) {
            tokens[empresaId] = (await criarUsuario(pool, { empresaId, perfil: 'Administrador' })).token;
        }
    });

    after(async () => {
        const servidor = server;
        if (servidor) await new Promise((resolve) => servidor.close(resolve));
        await pool.end();
        await banco.encerrar();
    });

    const procurarDepartamento = async (empresaId: number, sigla: string) => {
        const { corpo } = await chamar('GET', '/api/estrutura/departamentos', empresaId);
        return (corpo as Departamento[]).find((d) => d.sigla === sigla);
    };

    const departamentoDe = async (empresaId: number, sigla: string): Promise<Departamento> => {
        const departamento = await procurarDepartamento(empresaId, sigla);
        assert.ok(departamento, `departamento ${sigla} ausente`);
        return departamento;
    };

    const idDoDepartamento = async (empresaId: number, sigla: string): Promise<number> =>
        (await pool.query<RowDataPacket[]>('SELECT id FROM departamentos WHERE empresa_id = ? AND sigla = ?', [empresaId, sigla]))[0][0].id;

    it('conta os colaboradores de cada departamento da empresa', async () => {
        const ti = await departamentoDe(alfa, 'TI');
        assert.equal(ti.total_colaboradores, 1);
        assert.equal(ti.colaboradores_ativos, 1);

        const rh = await departamentoDe(alfa, 'RH');
        assert.equal(rh.total_colaboradores, 1);
        const mkt = await departamentoDe(alfa, 'MKT');
        assert.equal(mkt.total_colaboradores, 0);
        assert.equal(mkt.colaboradores_ativos, 0);
    });

    it('não conta colaborador de outra empresa nem multiplica pelos cargos do departamento', async () => {
        const ti = await idDoDepartamento(alfa, 'TI');
        await pool.query('INSERT INTO cargos (nome, departamento_id, empresa_id) VALUES (?, ?, ?), (?, ?, ?)',
            ['Cargo Extra 1', ti, alfa, 'Cargo Extra 2', ti, alfa]);

        const depto = await departamentoDe(alfa, 'TI');
        assert.equal(depto.total_colaboradores, 1);
        assert.equal(depto.total_cargos, 3);
        assert.equal((await departamentoDe(beta, 'TI')).total_colaboradores, 1);
    });

    it('separa total de ativos quando há colaborador inativo', async () => {
        const ti = await idDoDepartamento(alfa, 'TI');
        await pool.query(
            "INSERT INTO funcionarios (nome, email, departamento_id, status, empresa_id) VALUES ('Fulano Inativo Ficticio', 'inativo@alfa.exemplo.invalid', ?, 'Inativo', ?)",
            [ti, alfa]
        );
        const depto = await departamentoDe(alfa, 'TI');
        assert.equal(depto.total_colaboradores, 2);
        assert.equal(depto.colaboradores_ativos, 1);
    });

    it('lista cada cargo com a sigla do departamento e os ocupantes ativos', async () => {
        const { corpo } = await chamar('GET', '/api/estrutura/cargos', alfa);
        const cargoDe = (nome: string): Cargo => {
            const cargo = (corpo as Cargo[]).find((c) => c.nome === nome);
            assert.ok(cargo, `cargo ${nome} ausente`);
            return cargo;
        };
        const dev = cargoDe('Desenvolvedor(a)');
        assert.equal(dev.ocupantes, 1);
        assert.equal(dev.departamento_sigla, 'TI');
        assert.equal(dev.departamento_nome, 'Tecnologia da Informação (TI)');
        assert.equal(cargoDe('Cargo Extra 1').ocupantes, 0);
        assert.equal(cargoDe('Assistente Administrativo').departamento_sigla, 'FIN');
    });

    it('não mistura ocupantes de empresas que têm cargos de mesmo nome', async () => {
        const { corpo } = await chamar('GET', '/api/estrutura/cargos', beta);
        const dev = (corpo as Cargo[]).find((c) => c.nome === 'Desenvolvedor(a)');
        assert.equal(dev?.ocupantes, 1);
    });

    it('recusa excluir departamento com cargos e diz o motivo', async () => {
        const ti = await departamentoDe(alfa, 'TI');
        const { status, corpo } = await chamar('DELETE', `/api/estrutura/departamentos/${ti.id}`, alfa);
        assert.equal(status, 400);
        assert.match(corpo.erro, /possui cargos associados/);
    });

    it('responde 404 ao excluir cargo ou departamento de outra empresa, sem revelar dependências', async () => {
        const [[cargoDoBeta]] = await pool.query<RowDataPacket[]>("SELECT id FROM cargos WHERE empresa_id = ? AND nome = 'Desenvolvedor(a)'", [beta]);
        const deptoDoBeta = await departamentoDe(beta, 'TI');

        const cargo = await chamar('DELETE', `/api/estrutura/cargos/${cargoDoBeta.id}`, alfa);
        assert.equal(cargo.status, 404);
        assert.equal(cargo.corpo.erro, 'Cargo não encontrado.');

        const depto = await chamar('DELETE', `/api/estrutura/departamentos/${deptoDoBeta.id}`, alfa);
        assert.equal(depto.status, 404);
        assert.equal(depto.corpo.erro, 'Departamento não encontrado.');

        const [[{ cargos }]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cargos FROM cargos WHERE id = ?', [cargoDoBeta.id]);
        assert.equal(cargos, 1);
    });

    it('exclui departamento vazio e cargo sem ocupantes da própria empresa', async () => {
        const mkt = await departamentoDe(alfa, 'MKT');
        const { corpo: cargos } = await chamar('GET', '/api/estrutura/cargos', alfa);
        for (const cargo of (cargos as Cargo[]).filter((c) => c.departamento_id === mkt.id)) {
            assert.equal((await chamar('DELETE', `/api/estrutura/cargos/${cargo.id}`, alfa)).status, 200);
        }
        assert.equal((await chamar('DELETE', `/api/estrutura/departamentos/${mkt.id}`, alfa)).status, 200);
        assert.equal(await procurarDepartamento(alfa, 'MKT'), undefined);
    });
});
