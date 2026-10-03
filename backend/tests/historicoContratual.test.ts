// B-22: o histórico contratual guarda, com vigência, cada período em que o colaborador teve o mesmo
// salário, cargo e departamento. Contra o app inteiro e um MySQL migrado (tests/support/bancoDeTeste.ts);
// sem HRFLOW_TEST_DB_HOST os testes são marcados como ignorados, nunca como aprovados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import type { RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarCliente } from './support/cliente.ts';
import { criarColaborador, criarEmpresa } from './support/empresas.ts';
import { criarUsuario } from './support/sessao.ts';
import { LIMITES_AUTH_FOLGADOS, pararServidor, subirServidor } from './support/servidor.ts';
import db from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import { relogio } from '../shared/utils/relogio.ts';

interface Periodo { salario_base: string | null; cargo: string | null; departamento: string | null; vigencia_inicio: string; vigencia_fim: string | null }

describe('histórico contratual (B-22)', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let chamar: ReturnType<typeof criarCliente>;
    let empresa: number;
    let admin: string;
    let rh: string;
    let colaborador: string;
    let cargos: RowDataPacket[];
    let departamentos: RowDataPacket[];
    const relogioOriginal = relogio.agora;
    let sequencia = 0;

    // Meio-dia em Belém (15:00 UTC) do dia pedido: longe da virada do dia.
    const estarEm = (dia: string) => { relogio.agora = () => Date.parse(`${dia}T15:00:00Z`); };

    const historico = async (id: number, token = admin): Promise<Periodo[]> => {
        const { status, corpo } = await chamar('GET', `/api/funcionarios/${id}/historico-contratual`, token);
        assert.equal(status, 200, JSON.stringify(corpo));
        return corpo;
    };
    const resumo = (periodos: Periodo[]) => periodos.map((p) => [p.vigencia_inicio, p.vigencia_fim, Number(p.salario_base), p.cargo, p.departamento]);

    const cadastrar = async (extra: Record<string, unknown> = {}) => {
        const email = `historico.${process.pid}.${++sequencia}@exemplo.invalid`;
        const criado = await chamar('POST', '/api/funcionarios', admin, { nome: `Pessoa ${sequencia}`, email, senha: 'senha-ficticia-1', ...extra });
        assert.equal(criado.status, 201, JSON.stringify(criado.corpo));
        const [[{ id }]] = await db.query<RowDataPacket[]>('SELECT id FROM funcionarios WHERE email = ?', [email]);
        return { id: id as number, email, nome: `Pessoa ${sequencia}` };
    };
    const editar = (id: number, pessoa: { email: string; nome: string }, extra: Record<string, unknown>) =>
        chamar('PATCH', `/api/funcionarios/${id}`, admin, { nome: pessoa.nome, email: pessoa.email, ...extra });

    before(async () => {
        await banco.preparar();
        const { server, baseUrl } = await subirServidor(criarApp({ limitesAuth: LIMITES_AUTH_FOLGADOS }));
        servidor = server;
        chamar = criarCliente(baseUrl);
        empresa = (await criarEmpresa(db)).empresaId;
        admin = (await criarUsuario(db, { empresaId: empresa, perfil: 'Administrador' })).token;
        rh = (await criarUsuario(db, { empresaId: empresa, perfil: 'RH' })).token;
        colaborador = (await criarColaborador(db, empresa, { nome: 'Caio', salario: 3000 })).token;
        [cargos] = await db.query<RowDataPacket[]>('SELECT id, nome FROM cargos WHERE empresa_id = ? ORDER BY id', [empresa]);
        [departamentos] = await db.query<RowDataPacket[]>('SELECT id, nome FROM departamentos WHERE empresa_id = ? ORDER BY id', [empresa]);
    });

    after(async () => {
        relogio.agora = relogioOriginal;
        await pararServidor(servidor);
        await db.end();
        await banco.encerrar();
    });

    it('o cadastro novo abre um período em vigor desde a admissão, com os nomes de cargo e departamento da época', async () => {
        estarEm('2026-06-15');
        const { id } = await cadastrar({ data_admissao: '2025-02-03', salario_base: 3000, cargo_id: cargos[0].id, departamento_id: departamentos[0].id });
        assert.deepEqual(resumo(await historico(id)), [['2025-02-03', null, 3000, cargos[0].nome, departamentos[0].nome]]);
    });

    it('sem data de admissão o período começa no dia do cadastro', async () => {
        estarEm('2026-06-15');
        const { id } = await cadastrar({ salario_base: 2000 });
        assert.deepEqual(resumo(await historico(id)), [['2026-06-15', null, 2000, null, null]]);
    });

    it('mudar o salário fecha o período no dia anterior e abre outro a partir de hoje', async () => {
        estarEm('2026-06-15');
        const pessoa = await cadastrar({ data_admissao: '2025-02-03', salario_base: 3000, cargo_id: cargos[0].id });
        assert.equal((await editar(pessoa.id, pessoa, { salario_base: 3500, cargo_id: cargos[0].id })).status, 200);
        assert.deepEqual(resumo(await historico(pessoa.id)), [
            ['2026-06-15', null, 3500, cargos[0].nome, null],
            ['2025-02-03', '2026-06-14', 3000, cargos[0].nome, null],
        ]);
    });

    it('mudar o cargo e o departamento em outro dia abre mais um período', async () => {
        estarEm('2026-06-15');
        const pessoa = await cadastrar({ data_admissao: '2025-02-03', salario_base: 3000, cargo_id: cargos[0].id, departamento_id: departamentos[0].id });
        estarEm('2026-07-01');
        await editar(pessoa.id, pessoa, { salario_base: 3000, cargo_id: cargos[1].id, departamento_id: departamentos[1].id });
        assert.deepEqual(resumo(await historico(pessoa.id)), [
            ['2026-07-01', null, 3000, cargos[1].nome, departamentos[1].nome],
            ['2025-02-03', '2026-06-30', 3000, cargos[0].nome, departamentos[0].nome],
        ]);
    });

    it('duas edições no mesmo dia corrigem o período aberto em vez de deixar um período vazio', async () => {
        estarEm('2026-06-15');
        const pessoa = await cadastrar({ data_admissao: '2025-02-03', salario_base: 3000 });
        estarEm('2026-08-10');
        await editar(pessoa.id, pessoa, { salario_base: 3100 });
        await editar(pessoa.id, pessoa, { salario_base: 3200 });
        assert.deepEqual(resumo(await historico(pessoa.id)), [
            ['2026-08-10', null, 3200, null, null],
            ['2025-02-03', '2026-08-09', 3000, null, null],
        ]);
    });

    it('editar o que não é salário, cargo nem departamento não abre período', async () => {
        const pessoa = await cadastrar({ data_admissao: '2025-02-03', salario_base: 3000 });
        assert.equal((await editar(pessoa.id, pessoa, { salario_base: 3000, telefone: '(00) 92222-2222', endereco: 'Rua Ficticia, 1' })).status, 200);
        assert.equal((await historico(pessoa.id)).length, 1);
    });

    it('um cadastro anterior ao histórico ganha o primeiro período, desde a admissão, na primeira mudança', async () => {
        estarEm('2026-09-01');
        const { funcionarioId } = await criarColaborador(db, empresa, { nome: 'Antigo', salario: 2500, admissao: '2023-05-01' });
        await db.query('DELETE FROM historico_contratual WHERE funcionario_id = ?', [funcionarioId]);
        const [[{ email }]] = await db.query<RowDataPacket[]>('SELECT email FROM funcionarios WHERE id = ?', [funcionarioId]);
        assert.equal((await editar(funcionarioId, { email, nome: 'Antigo' }, { salario_base: 2800, data_admissao: '2023-05-01' })).status, 200);
        assert.deepEqual(resumo(await historico(funcionarioId)), [['2023-05-01', null, 2800, null, null]]);
    });

    it('desligar o colaborador não mexe no histórico', async () => {
        const pessoa = await cadastrar({ data_admissao: '2025-02-03', salario_base: 3000 });
        await chamar('PATCH', `/api/funcionarios/${pessoa.id}/status`, admin, { status: 'Inativo', data_desligamento: '2026-01-10', motivo_desligamento: 'Fim do contrato' });
        assert.equal((await historico(pessoa.id)).length, 1);
    });

    it('o RH lê o histórico; o Colaborador recebe 403; o cadastro de outra empresa responde 404', async () => {
        const { id } = await cadastrar({ salario_base: 3000 });
        assert.equal((await historico(id, rh)).length, 1);
        assert.equal((await chamar('GET', `/api/funcionarios/${id}/historico-contratual`, colaborador)).status, 403);

        const outra = (await criarEmpresa(db)).empresaId;
        const adminDeOutra = (await criarUsuario(db, { empresaId: outra, perfil: 'Administrador' })).token;
        assert.equal((await chamar('GET', `/api/funcionarios/${id}/historico-contratual`, adminDeOutra)).status, 404);
    });

    it('excluir o cadastro sem movimento leva o histórico junto', async () => {
        const { id } = await cadastrar({ salario_base: 3000 });
        assert.equal((await chamar('DELETE', `/api/funcionarios/${id}`, admin)).status, 200);
        const [linhas] = await db.query<RowDataPacket[]>('SELECT id FROM historico_contratual WHERE funcionario_id = ?', [id]);
        assert.equal(linhas.length, 0);
    });
});
