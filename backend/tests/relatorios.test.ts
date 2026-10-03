// Relatórios da gestão (GET /api/relatorios/...): headcount e turnover, aniversariantes, custo por
// departamento e absenteísmo, em JSON e exportados em CSV e PDF. Os números são conferidos contra fixtures
// de datas fixas e o relógio do servidor é fixado. MySQL real e descartável (tests/support/bancoDeTeste.ts);
// sem HRFLOW_TEST_DB_HOST o teste é pulado.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import type { ResultSetHeader } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarColaborador, criarEmpresa, criarFuncionario } from './support/empresas.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import { subirServidor, pararServidor } from './support/servidor.ts';
import { textosDoPdf } from './support/pdf.ts';
import db from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import { criarFuso, relogio } from '../shared/utils/fuso.ts';

const belem = criarFuso('America/Belem');

describe('relatórios', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let baseUrl: string;

    const pedir = async (caminho: string, token: string | undefined, metodo = 'GET') => fetch(`${baseUrl}${caminho}`, { method: metodo, headers: cabecalhosDaSessao(token) });
    const json = async (caminho: string, token: string | undefined, metodo = 'GET') => {
        const resposta = await pedir(caminho, token, metodo);
        const texto = await resposta.text();
        return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
    };

    const inserir = async (sql: string, valores: unknown[]) => (await db.query<ResultSetHeader>(sql, valores))[0].insertId;
    const departamento = (empresaId: number, nome: string) =>
        inserir('INSERT INTO departamentos (nome, sigla, empresa_id) VALUES (?, ?, ?)', [nome, nome.slice(0, 4).toUpperCase(), empresaId]);
    const noDepartamento = (funcionarioId: number, departamentoId: number) =>
        db.query('UPDATE funcionarios SET departamento_id = ? WHERE id = ?', [departamentoId, funcionarioId]);
    const nascimento = (funcionarioId: number, data: string) => db.query('UPDATE funcionarios SET data_nascimento = ? WHERE id = ?', [data, funcionarioId]);

    before(async () => {
        await banco.preparar();
        ({ server: servidor, baseUrl } = await subirServidor(criarApp()));
    });

    afterEach(() => { relogio.agora = () => Date.now(); });

    after(async () => {
        await pararServidor(servidor);
        await db.end();
        await banco.encerrar();
    });

    describe('headcount', () => {
        let admin: string;
        let rh: string;
        let colaborador: string;
        let outraEmpresa: string;

        before(async () => {
            const { empresaId } = await criarEmpresa(db);
            admin = (await criarUsuario(db, { empresaId, perfil: 'Administrador' })).token;
            rh = (await criarUsuario(db, { empresaId, perfil: 'RH' })).token;
            colaborador = (await criarUsuario(db, { empresaId, perfil: 'Colaborador' })).token;

            const pessoa = (nome: string, admissao: string | null, desligamento?: string | null, status: 'Ativo' | 'Inativo' = 'Ativo') =>
                criarFuncionario(db, empresaId, { nome, salario: 3000, admissao, status: desligamento !== undefined || status === 'Inativo' ? 'Inativo' : 'Ativo', desligamento: desligamento ?? null });
            await pessoa('Ana', '2025-12-01');
            await pessoa('Bruno', '2026-01-10');
            await pessoa('Carla', '2026-01-20', '2026-03-05');
            await pessoa('Davi', '2026-02-02');
            await pessoa('Eva', '2026-03-15');
            await pessoa('Fabio', null);
            await pessoa('Gil', '2025-06-01', '2026-02-10');
            await pessoa('Hugo', '2026-10-05');
            // Inativo antigo, sem data de desligamento: não se sabe quando saiu, então nunca entra na conta.
            await pessoa('Ines', '2025-01-01', null, 'Inativo');

            // Outra empresa com gente no mesmo período: não pode aparecer nos números da primeira.
            const outra = await criarEmpresa(db);
            outraEmpresa = (await criarUsuario(db, { empresaId: outra.empresaId, perfil: 'Administrador' })).token;
            await criarFuncionario(db, outra.empresaId, { nome: 'Zeca', salario: 1, admissao: '2026-01-05' });
        });

        it('devolve uma linha por mês, de janeiro a outubro, com admitidos, desligados e ativos conferidos', async () => {
            const { status, corpo } = await json('/api/relatorios/headcount?de=2026-01&ate=2026-10', admin);
            assert.equal(status, 200);
            assert.equal(corpo.length, 10);
            // Fim de 2025: Ana, Fabio (sem data de admissão) e Gil. Ines (Inativo sem data) nunca conta.
            assert.deepEqual(corpo, [
                { mes: '2026-01', admitidos: 2, desligados: 0, ativos: 5, turnover: 0 },
                { mes: '2026-02', admitidos: 1, desligados: 1, ativos: 5, turnover: 20 },
                { mes: '2026-03', admitidos: 1, desligados: 1, ativos: 5, turnover: 20 },
                { mes: '2026-04', admitidos: 0, desligados: 0, ativos: 5, turnover: 0 },
                { mes: '2026-05', admitidos: 0, desligados: 0, ativos: 5, turnover: 0 },
                { mes: '2026-06', admitidos: 0, desligados: 0, ativos: 5, turnover: 0 },
                { mes: '2026-07', admitidos: 0, desligados: 0, ativos: 5, turnover: 0 },
                { mes: '2026-08', admitidos: 0, desligados: 0, ativos: 5, turnover: 0 },
                { mes: '2026-09', admitidos: 0, desligados: 0, ativos: 5, turnover: 0 },
                { mes: '2026-10', admitidos: 1, desligados: 0, ativos: 6, turnover: 0 },
            ]);
        });

        it('o RH também consulta; o período de um mês só devolve um mês; o mesmo mês entra nas duas pontas', async () => {
            const { status, corpo } = await json('/api/relatorios/headcount?de=2026-03&ate=2026-03', rh);
            assert.equal(status, 200);
            assert.deepEqual(corpo, [{ mes: '2026-03', admitidos: 1, desligados: 1, ativos: 5, turnover: 20 }]);
        });

        it('um período anterior a tudo devolve zeros, e atravessar o ano funciona', async () => {
            const { corpo } = await json('/api/relatorios/headcount?de=2025-11&ate=2026-01', admin);
            assert.deepEqual(corpo.map((l: { mes: string; admitidos: number; ativos: number }) => [l.mes, l.admitidos, l.ativos]), [
                ['2025-11', 0, 2], ['2025-12', 1, 3], ['2026-01', 2, 5],
            ]);
        });

        it('não mistura as empresas', async () => {
            const { corpo } = await json('/api/relatorios/headcount?de=2026-01&ate=2026-01', outraEmpresa);
            assert.deepEqual(corpo, [{ mes: '2026-01', admitidos: 1, desligados: 0, ativos: 1, turnover: 0 }]);
        });

        it('recusa período invertido, longo demais, mês inválido, parâmetro faltando e formato desconhecido', async () => {
            const casos: [string, RegExp][] = [
                ['?de=2026-05&ate=2026-04', /não pode ser depois/],
                ['?de=2020-01&ate=2026-01', /no máximo 60 meses/],
                ['?de=2026-13&ate=2026-14', /formato AAAA-MM/],
                ['?de=2026-01', /O mês final \(ate\)/],
                ['', /O mês inicial \(de\)/],
                ['?de=2026-01&ate=2026-02&formato=xml', /O formato deve ser um destes/],
            ];
            for (const [query, mensagem] of casos) {
                const { status, corpo } = await json(`/api/relatorios/headcount${query}`, admin);
                assert.equal(status, 400, query);
                assert.match(corpo.erro, mensagem, query);
            }
        });

        it('o colaborador não consulta e sem sessão a API recusa', async () => {
            assert.equal((await json('/api/relatorios/headcount?de=2026-01&ate=2026-02', colaborador)).status, 403);
            assert.equal((await json('/api/relatorios/headcount?de=2026-01&ate=2026-02', undefined)).status, 401);
        });

        it('exporta em CSV com acentuação correta: UTF-8 com BOM, nome de arquivo e sem cache', async () => {
            const resposta = await pedir('/api/relatorios/headcount?de=2026-01&ate=2026-03&formato=csv', admin);
            assert.equal(resposta.status, 200);
            assert.equal(resposta.headers.get('content-type'), 'text/csv; charset=utf-8');
            assert.equal(resposta.headers.get('content-disposition'), 'attachment; filename="headcount-2026-01-a-2026-03.csv"');
            assert.equal(resposta.headers.get('cache-control'), 'no-store');
            const bytes = Buffer.from(await resposta.arrayBuffer());
            assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
            assert.deepEqual(bytes.toString('utf8').slice(1).split('\r\n'), [
                'Mês;Admitidos;Desligados;Ativos no fim do mês;Turnover (%)',
                '01/2026;2;0;5;0,0',
                '02/2026;1;1;5;20,0',
                '03/2026;1;1;5;20,0',
                'Total;4;2;5;50,0',
                '',
            ]);
        });

        it('exporta em PDF com o título, o período, a empresa e a tabela', async () => {
            const resposta = await pedir('/api/relatorios/headcount?de=2026-01&ate=2026-03&formato=pdf', rh);
            assert.equal(resposta.status, 200);
            assert.equal(resposta.headers.get('content-type'), 'application/pdf');
            assert.equal(resposta.headers.get('content-disposition'), 'attachment; filename="headcount-2026-01-a-2026-03.pdf"');
            const pdf = Buffer.from(await resposta.arrayBuffer());
            assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
            const textos = textosDoPdf(pdf);
            assert.ok(textos.includes('Headcount e turnover'));
            assert.ok(textos.some((t) => t.endsWith('01/2026 a 03/2026')), JSON.stringify(textos));
            assert.ok(textos.includes('02/2026'));
            assert.ok(textos.includes('20,0%'));
        });
    });

    describe('aniversariantes', () => {
        it('lista quem faz aniversário no mês, por dia e nome, sem o ano, sem desligados e só da empresa', async () => {
            const { empresaId } = await criarEmpresa(db);
            const admin = (await criarUsuario(db, { empresaId, perfil: 'Administrador' })).token;
            const dep = await departamento(empresaId, 'Pessoas');
            const nova = async (nome: string, data: string | null, status: 'Ativo' | 'Inativo' | 'Férias' = 'Ativo') => {
                const id = await criarFuncionario(db, empresaId, { nome, salario: 1000, status, desligamento: status === 'Inativo' ? '2026-01-31' : null });
                await noDepartamento(id, dep);
                if (data) await nascimento(id, data);
                return id;
            };
            await nova('Beto', '1990-03-20');
            await nova('Ana', '1985-03-20');
            await nova('Caio', '2000-03-02', 'Férias');
            await nova('Dora', '1995-04-01');
            await nova('Eva Desligada', '1990-03-10', 'Inativo');
            await nova('Fabio Sem Data', null);
            const outra = await criarEmpresa(db);
            await criarFuncionario(db, outra.empresaId, { nome: 'Zeca Outra Empresa', salario: 1 }).then((id) => nascimento(id, '1990-03-01'));

            const { status, corpo } = await json('/api/relatorios/aniversariantes?mes=2026-03', admin);
            assert.equal(status, 200);
            assert.deepEqual(corpo.map((a: { nome: string; dia: number }) => [a.dia, a.nome]), [[2, 'Caio'], [20, 'Ana'], [20, 'Beto']]);
            assert.equal(corpo[0].departamento, 'Pessoas');
            assert.equal(JSON.stringify(corpo).includes('1990'), false, 'o ano de nascimento não é exposto');
            assert.equal(JSON.stringify(corpo).includes('Zeca'), false);
        });

        it('sem mês, vale o mês corrente no fuso da empresa, e exporta em CSV', async () => {
            const { empresaId } = await criarEmpresa(db);
            await db.query('UPDATE empresas SET fuso = ? WHERE id = ?', ['America/Manaus', empresaId]);
            const rh = (await criarUsuario(db, { empresaId, perfil: 'RH' })).token;
            const id = await criarFuncionario(db, empresaId, { nome: 'Joana Açaí', salario: 1 });
            await nascimento(id, '1990-03-31');

            // 03:30Z de 01/04 é 00:30 de abril em Belém, mas ainda 23:30 de 31/03 em Manaus.
            relogio.agora = () => Date.parse('2026-04-01T03:30:00Z');
            const { corpo } = await json('/api/relatorios/aniversariantes', rh);
            assert.deepEqual(corpo.map((a: { nome: string }) => a.nome), ['Joana Açaí']);

            const csv = await pedir('/api/relatorios/aniversariantes?formato=csv', rh);
            assert.equal(csv.headers.get('content-disposition'), 'attachment; filename="aniversariantes-2026-03.csv"');
            assert.deepEqual(Buffer.from(await csv.arrayBuffer()).toString('utf8').slice(1).split('\r\n').slice(0, 2), ['Dia;Colaborador;Departamento;Cargo', '31;Joana Açaí;Tecnologia da Informação (TI);Desenvolvedor(a)']);
        });
    });

    describe('custo por departamento', () => {
        it('o total do PDF e do JSON é exatamente o da folha fechada', async () => {
            const { empresaId } = await criarEmpresa(db);
            const admin = (await criarUsuario(db, { empresaId, perfil: 'Administrador' })).token;
            const tecnologia = await departamento(empresaId, 'Tecnologia');
            const financeiro = await departamento(empresaId, 'Financeiro');
            const nova = async (nome: string, salario: number, dep: number | null) => {
                const id = await criarFuncionario(db, empresaId, { nome, salario, admissao: '2024-01-02' });
                if (dep) await noDepartamento(id, dep);
            };
            await nova('Ana', 5432.1, tecnologia);
            await nova('Bruno', 8765.43, tecnologia);
            await nova('Carla', 2100.99, financeiro);
            await nova('Davi', 1621, null);
            await db.query('UPDATE funcionarios SET departamento_id = NULL WHERE nome = ?', ['Davi']);

            const competencia = belem.mesLocal(Math.floor(Date.now() / 1000));
            assert.equal((await json(`/api/folha/competencias/${competencia}/processar`, admin, 'POST')).status, 201);
            const aberta = await json(`/api/relatorios/custo-departamento?competencia=${competencia}`, admin);
            assert.equal(aberta.status, 200);
            assert.equal(aberta.corpo.statusDaFolha, 'aberta');

            assert.equal((await json(`/api/folha/competencias/${competencia}/fechar`, admin, 'POST')).status, 200);
            const folha = (await json(`/api/folha/competencias/${competencia}`, admin)).corpo;
            const { status, corpo } = await json(`/api/relatorios/custo-departamento?competencia=${competencia}`, admin);
            assert.equal(status, 200);
            assert.equal(corpo.statusDaFolha, 'fechada');
            assert.deepEqual(corpo.departamentos.map((d: { departamento: string; colaboradores: number }) => [d.departamento, d.colaboradores]), [['Financeiro', 1], ['Não definido', 1], ['Tecnologia', 2]]);

            // O total é o da folha, centavo a centavo, e a soma das linhas é o total.
            assert.deepEqual(
                { bruto: corpo.total.bruto, descontos: corpo.total.descontos, liquido: corpo.total.liquido, encargos: corpo.total.encargos },
                folha.totais,
            );
            for (const campo of ['bruto', 'descontos', 'liquido', 'encargos', 'custoTotal']) {
                const soma = corpo.departamentos.reduce((total: number, d: Record<string, number>) => total + Math.round(d[campo] * 100), 0);
                assert.equal(soma, Math.round(corpo.total[campo] * 100), campo);
            }
            assert.equal(Math.round(corpo.total.custoTotal * 100), Math.round((folha.totais.bruto + folha.totais.encargos) * 100));

            const pdf = Buffer.from(await (await pedir(`/api/relatorios/custo-departamento?competencia=${competencia}&formato=pdf`, admin)).arrayBuffer());
            const textos = textosDoPdf(pdf);
            const moeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor).replace(/\s/g, ' ');
            for (const esperado of [
                'Custo por departamento', 'Tecnologia', 'Financeiro', 'Não definido', 'Total',
                moeda(folha.totais.bruto), moeda(folha.totais.descontos), moeda(folha.totais.liquido), moeda(folha.totais.encargos),
                moeda(Math.round((folha.totais.bruto + folha.totais.encargos) * 100) / 100),
            ]) {
                assert.ok(textos.includes(esperado), `${esperado} não está no PDF: ${JSON.stringify(textos)}`);
            }
            assert.ok(textos.some((t) => t.includes('folha fechada')));

            const csv = Buffer.from(await (await pedir(`/api/relatorios/custo-departamento?competencia=${competencia}&formato=csv`, admin)).arrayBuffer()).toString('utf8').slice(1).split('\r\n');
            assert.equal(csv[0], 'Departamento;Colaboradores;Bruto (R$);Descontos (R$);Líquido (R$);Encargos (R$);Custo total (R$)');
            assert.equal(csv.at(-2)!.split(';')[0], 'Total');
            assert.equal(csv.at(-2)!.split(';')[2], folha.totais.bruto.toFixed(2).replace('.', ','));
        });

        it('uma competência sem folha processada é 404, e a competência inválida é 400', async () => {
            const { empresaId } = await criarEmpresa(db);
            const admin = (await criarUsuario(db, { empresaId, perfil: 'Administrador' })).token;
            const semFolha = await json('/api/relatorios/custo-departamento?competencia=2025-01', admin);
            assert.equal(semFolha.status, 404);
            assert.match(semFolha.corpo.erro, /ainda não foi processada/);
            assert.equal((await json('/api/relatorios/custo-departamento?competencia=2025-13', admin)).status, 400);
            assert.equal((await json('/api/relatorios/custo-departamento', admin)).status, 400);
        });
    });

    describe('absenteísmo', () => {
        // Março de 2026 tem 22 dias úteis (02 a 31). O relógio fica em 02/04: todos já foram apurados.
        const MARCO = '2026-03';
        const diasUteis = (de: string, ate: string) => {
            const dias: string[] = [];
            for (let d = new Date(`${de}T00:00:00Z`); d <= new Date(`${ate}T00:00:00Z`); d = new Date(d.getTime() + 86400000)) {
                if (![0, 6].includes(d.getUTCDay())) dias.push(d.toISOString().slice(0, 10));
            }
            return dias;
        };
        // 08:00 e 17:00 do relógio de Belém, como instantes.
        const marcar = (funcionarioId: number, empresaId: number, dia: string, entrada: number, saida: number) => db.query(
            `INSERT INTO registro_pontos (funcionario_id, empresa_id, tipo_registro, data_hora_oficial) VALUES (?, ?, 'Entrada', FROM_UNIXTIME(?)), (?, ?, 'Saída', FROM_UNIXTIME(?))`,
            [funcionarioId, empresaId, belem.limitesDoDia(dia).inicio + entrada * 3600, funcionarioId, empresaId, belem.limitesDoDia(dia).inicio + saida * 3600]
        );

        it('conta faltas, justificadas, atrasos e a taxa por departamento, só nos dias apurados de cada um', async () => {
            const { empresaId } = await criarEmpresa(db);
            const rh = (await criarUsuario(db, { empresaId, perfil: 'RH' })).token;
            const colaborador = (await criarUsuario(db, { empresaId, perfil: 'Colaborador' })).token;
            const alfa = await departamento(empresaId, 'Alfa');
            const beta = await departamento(empresaId, 'Beta');
            const nova = async (nome: string, dep: number, admissao: string, extra: { status?: 'Ativo' | 'Inativo'; desligamento?: string } = {}) => {
                const id = await criarFuncionario(db, empresaId, { nome, salario: 3000, admissao, status: extra.status, desligamento: extra.desligamento });
                await noDepartamento(id, dep);
                return id;
            };

            const caio = await nova('Caio', alfa, '2024-01-02');
            for (const dia of diasUteis('2026-03-02', '2026-03-31')) {
                if (['2026-03-10', '2026-03-11'].includes(dia)) continue;
                await marcar(caio, empresaId, dia, dia === '2026-03-12' ? 9 : 8, 17);
            }
            // 10/03: falta. 11/03: sem marcação, mas a justificativa foi aprovada. 12/03: chegou às 09:00 (atraso).
            await db.query(`INSERT INTO justificativas_ponto (empresa_id, funcionario_id, data_referencia, texto, status) VALUES (?, ?, '2026-03-11', 'Atestado.', 'aprovada')`, [empresaId, caio]);

            const eva = await nova('Eva', alfa, '2026-03-26');
            for (const dia of diasUteis('2026-03-26', '2026-03-30')) await marcar(eva, empresaId, dia, 8, 17);
            // Eva foi admitida em 26/03: os dias anteriores não são dela, e 31/03 sem marcação é falta.

            const dora = await nova('Dora', beta, '2024-01-02');
            for (const dia of diasUteis('2026-03-02', '2026-03-31')) await marcar(dora, empresaId, dia, 8, 17);

            // Fred saiu em 13/03: só os dias até ali contam (10 dias úteis, todos sem marcação).
            await nova('Fred', beta, '2024-01-02', { status: 'Inativo', desligamento: '2026-03-13' });
            // Gil saiu antes do mês: não aparece.
            await nova('Gil', beta, '2024-01-02', { status: 'Inativo', desligamento: '2026-02-20' });

            relogio.agora = () => Date.parse('2026-04-02T12:00:00Z');
            const { status, corpo } = await json(`/api/relatorios/absenteismo?mes=${MARCO}`, rh);
            assert.equal(status, 200);
            assert.equal(corpo.mes, MARCO);
            assert.deepEqual(corpo.departamentos, [
                { departamento: 'Alfa', colaboradores: 2, diasApurados: 26, faltas: 2, ausenciasJustificadas: 1, atrasos: 1, taxa: 11.5 },
                { departamento: 'Beta', colaboradores: 2, diasApurados: 32, faltas: 10, ausenciasJustificadas: 0, atrasos: 0, taxa: 31.3 },
            ]);
            assert.deepEqual(corpo.total, { departamento: 'Total', colaboradores: 4, diasApurados: 58, faltas: 12, ausenciasJustificadas: 1, atrasos: 1, taxa: 22.4 });

            assert.equal((await json(`/api/relatorios/absenteismo?mes=${MARCO}`, colaborador)).status, 403);

            const csv = Buffer.from(await (await pedir(`/api/relatorios/absenteismo?mes=${MARCO}&formato=csv`, rh)).arrayBuffer()).toString('utf8').slice(1).split('\r\n');
            assert.deepEqual(csv.slice(0, 2), ['Departamento;Colaboradores;Dias apurados;Faltas;Justificadas;Atrasos;Taxa (%)', 'Alfa;2;26;2;1;1;11,5']);
            const textos = textosDoPdf(Buffer.from(await (await pedir(`/api/relatorios/absenteismo?mes=${MARCO}&formato=pdf`, rh)).arrayBuffer()));
            assert.ok(textos.includes('Absenteísmo') && textos.includes('22,4%'), JSON.stringify(textos));
        });

        it('o dia de hoje e os futuros ficam fora da taxa: um mês que ainda corre só apura até ontem', async () => {
            const { empresaId } = await criarEmpresa(db);
            const rh = (await criarUsuario(db, { empresaId, perfil: 'RH' })).token;
            const id = await criarFuncionario(db, empresaId, { nome: 'Hugo', salario: 3000, admissao: '2024-01-02' });
            await marcar(id, empresaId, '2026-03-02', 8, 17);
            // Hoje é 04/03 (quarta) às 10:00: 02 (com marcação) e 03 (falta) já foram apurados; 04 em diante, não.
            relogio.agora = () => Date.parse('2026-03-04T13:00:00Z');
            const { corpo } = await json(`/api/relatorios/absenteismo?mes=${MARCO}`, rh);
            assert.deepEqual(corpo.total, { departamento: 'Total', colaboradores: 1, diasApurados: 2, faltas: 1, ausenciasJustificadas: 0, atrasos: 0, taxa: 50 });
        });

        it('a apuração do relatório é a mesma da tela do colaborador (mesmas faltas e atrasos)', async () => {
            const { empresaId } = await criarEmpresa(db);
            const rh = (await criarUsuario(db, { empresaId, perfil: 'RH' })).token;
            const caio = await criarColaborador(db, empresaId, { nome: 'Caio', salario: 3000, admissao: '2024-01-02' });
            for (const dia of diasUteis('2026-03-02', '2026-03-31')) {
                if (['2026-03-10', '2026-03-17'].includes(dia)) continue;
                await marcar(caio.funcionarioId, empresaId, dia, dia === '2026-03-12' ? 9 : 8, 17);
            }
            relogio.agora = () => Date.parse('2026-04-02T12:00:00Z');
            const totais = (await json(`/api/ponto/totais/${caio.funcionarioId}?mes=${MARCO}`, caio.token)).corpo.monthlySummary;
            const { corpo } = await json(`/api/relatorios/absenteismo?mes=${MARCO}`, rh);
            assert.equal(corpo.total.faltas, totais.absences);
            assert.equal(totais.absences, 2);
            assert.equal(corpo.total.diasApurados, 22);
        });
    });

    it('as rotas pedem sessão e a permissão relatorios:consultar', async () => {
        const { empresaId } = await criarEmpresa(db);
        const colaborador = (await criarUsuario(db, { empresaId, perfil: 'Colaborador' })).token;
        for (const caminho of ['headcount?de=2026-01&ate=2026-02', 'aniversariantes', 'custo-departamento?competencia=2026-01', 'absenteismo?mes=2026-01']) {
            assert.equal((await json(`/api/relatorios/${caminho}`, undefined)).status, 401, caminho);
            assert.equal((await json(`/api/relatorios/${caminho}`, colaborador)).status, 403, caminho);
        }
    });
});
