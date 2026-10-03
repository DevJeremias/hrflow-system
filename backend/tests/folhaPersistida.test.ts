// Folha persistida por competência (B-12): processar, conferir, fechar, e o holerite que o colaborador
// vê depois. MySQL real e descartável (tests/support/bancoDeTeste.ts); sem HRFLOW_TEST_DB_HOST o
// teste é pulado, nunca aprovado.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import { criarEmpresa, criarFuncionario, criarColaborador, novoCnpj } from './support/empresas.ts';
import pool from '../shared/db/pool.ts';
import authMiddleware from '../shared/middlewares/authMiddleware.ts';
import { folhaRoutes } from '../modules/folha/index.ts';
import { relogio } from '../modules/ponto/index.ts';
import type { FolhaDaCompetencia, HoleritePublicado } from '../modules/folha/folha.service.ts';

const COMPETENCIA = '2026-10';

describe('folha por competência', { skip: banco.skip }, () => {
    let server: http.Server, baseUrl: string;

    const chamar = async (metodo: string, caminho: string, token: string | null) => {
        const resposta = await fetch(`${baseUrl}/api/folha${caminho}`, { method: metodo, headers: cabecalhosDaSessao(token) });
        const texto = await resposta.text();
        return { status: resposta.status, corpo: texto ? JSON.parse(texto) : undefined };
    };
    const consultar = (token: string, competencia = COMPETENCIA) => chamar('GET', `/competencias/${competencia}`, token);
    const processar = (token: string, competencia = COMPETENCIA) => chamar('POST', `/competencias/${competencia}/processar`, token);
    const fechar = (token: string, competencia = COMPETENCIA) => chamar('POST', `/competencias/${competencia}/fechar`, token);
    const meuHolerite = (token: string, competencia = COMPETENCIA) => chamar('GET', `/meu-holerite?competencia=${competencia}`, token);

    // Uma empresa nova por cenário: a folha de uma competência é estado, e os cenários não dividem.
    const cenario = async (opcoes?: Parameters<typeof criarEmpresa>[1]) => {
        const empresa = await criarEmpresa(pool, opcoes);
        const rh = await criarUsuario(pool, { empresaId: empresa.empresaId, perfil: 'RH' });
        return { ...empresa, rh: rh.token };
    };

    const itemDe = (folha: FolhaDaCompetencia, funcionarioId: number) => {
        const item = folha.itens.find((i) => i.id === String(funcionarioId));
        assert.ok(item, `holerite de ${funcionarioId} ausente da folha`);
        return item;
    };

    before(async () => {
        await banco.preparar();
        const app = express();
        app.use(express.json());
        app.use('/api/folha', authMiddleware, folhaRoutes);
        server = http.createServer(app);
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    after(async () => {
        if (server) await new Promise((resolve) => server.close(resolve));
        await pool.end();
        await banco.encerrar();
    });

    describe('processar e consultar', () => {
        it('POST processar cria a folha (201), de novo a recalcula (200), e GET devolve itens, totais e empresa', async () => {
            const { empresaId, rh, razaoSocial, cnpj } = await cenario();
            const caio = await criarFuncionario(pool, empresaId, { nome: 'Caio Ficticio', salario: 6800 });
            const dora = await criarFuncionario(pool, empresaId, { nome: 'Dora Ficticia', salario: 2900 });

            assert.equal((await consultar(rh)).status, 404, 'antes de processar a folha não existe');

            const primeira = await processar(rh);
            assert.equal(primeira.status, 201);
            assert.equal(primeira.corpo.competencia, COMPETENCIA);
            assert.equal(primeira.corpo.status, 'aberta');
            assert.equal(primeira.corpo.fechadaEm, null);

            const segunda = await processar(rh);
            assert.equal(segunda.status, 200);
            assert.equal(segunda.corpo.itens.length, 2, 'reprocessar não duplica os itens');

            const { status, corpo } = await consultar(rh);
            assert.equal(status, 200);
            const folha = corpo as FolhaDaCompetencia;
            assert.deepEqual(folha.empresa, { razaoSocial, cnpj });
            assert.equal(itemDe(folha, caio).totalDeductions, 753.51);
            assert.equal(itemDe(folha, caio).netSalary, 6046.49);
            assert.equal(itemDe(folha, dora).totalDeductions, 236.69);
            assert.deepEqual(folha.totais, { bruto: 9700, descontos: 990.2, liquido: 8709.8, encargos: 2696.6 });
            assert.deepEqual(folha.pendencias, []);
            assert.deepEqual(itemDe(folha, caio).deductionsList, [{ description: 'Desconto INSS', value: 753.51, isPercentage: false }]);
        });

        it('PJ não tem INSS nem encargo CLT, estágio não tem INSS nem encargo, e os demais seguem a regra geral', async () => {
            const { empresaId, rh } = await cenario();
            const clt = await criarFuncionario(pool, empresaId, { nome: 'Clt Ficticio', salario: 5200, contrato: 'CLT' });
            const temporario = await criarFuncionario(pool, empresaId, { nome: 'Temporario Ficticio', salario: 2900, contrato: 'Temporário' });
            const semContrato = await criarFuncionario(pool, empresaId, { nome: 'Sem Contrato Ficticio', salario: 2900, contrato: null });
            const pj = await criarFuncionario(pool, empresaId, { nome: 'Pj Ficticio', salario: 3000, contrato: 'PJ' });
            const estagio = await criarFuncionario(pool, empresaId, { nome: 'Estagio Ficticio', salario: 1500, contrato: 'Estágio' });

            const folha = (await processar(rh)).corpo as FolhaDaCompetencia;
            const resumo = (id: number) => {
                const { totalDeductions, netSalary, employerCharges, deductionsList, contract } = itemDe(folha, id);
                return { totalDeductions, netSalary, employerCharges, rubricasDeDesconto: deductionsList.length, contract };
            };
            assert.deepEqual(resumo(clt), { totalDeductions: 529.51, netSalary: 4670.49, employerCharges: 1445.6, rubricasDeDesconto: 1, contract: 'CLT' });
            assert.deepEqual(resumo(temporario), { totalDeductions: 236.69, netSalary: 2663.31, employerCharges: 806.2, rubricasDeDesconto: 1, contract: 'Temporário' });
            assert.deepEqual(resumo(semContrato), { totalDeductions: 236.69, netSalary: 2663.31, employerCharges: 806.2, rubricasDeDesconto: 1, contract: null });
            assert.deepEqual(resumo(pj), { totalDeductions: 0, netSalary: 3000, employerCharges: 0, rubricasDeDesconto: 0, contract: 'PJ' });
            assert.deepEqual(resumo(estagio), { totalDeductions: 0, netSalary: 1500, employerCharges: 0, rubricasDeDesconto: 0, contract: 'Estágio' });
        });

        it('colaborador de férias entra na folha; inativo e admitido depois do mês, não', async () => {
            const { empresaId, rh } = await cenario();
            const ferias = await criarFuncionario(pool, empresaId, { nome: 'Ferias Ficticia', salario: 4000, status: 'Férias' });
            const ativo = await criarFuncionario(pool, empresaId, { nome: 'Ativa Ficticia', salario: 4000, admissao: '2026-10-31' });
            const inativo = await criarFuncionario(pool, empresaId, { nome: 'Inativo Ficticio', salario: 4000, status: 'Inativo' });
            const futuro = await criarFuncionario(pool, empresaId, { nome: 'Futuro Ficticio', salario: 4000, admissao: '2026-11-01' });

            const folha = (await processar(rh)).corpo as FolhaDaCompetencia;
            assert.deepEqual(folha.itens.map((i) => i.id).sort(), [String(ferias), String(ativo)].sort());
            assert.ok(![inativo, futuro].some((id) => folha.itens.some((i) => i.id === String(id))));
            assert.deepEqual(folha.pendencias, [], 'quem não é da folha também não é pendência');
        });

        it('colaborador sem salário aparece em pendências e não na folha', async () => {
            const { empresaId, rh } = await cenario();
            const comSalario = await criarFuncionario(pool, empresaId, { nome: 'Com Salario Ficticio', salario: 3000 });
            const semSalario = await criarFuncionario(pool, empresaId, { nome: 'Sem Salario Ficticio', salario: null });
            const salarioZero = await criarFuncionario(pool, empresaId, { nome: 'Salario Zero Ficticio', salario: 0 });

            const folha = (await processar(rh)).corpo as FolhaDaCompetencia;
            assert.deepEqual(folha.itens.map((i) => i.id), [String(comSalario)]);
            assert.deepEqual(folha.pendencias, [
                { funcionarioId: salarioZero, nome: 'Salario Zero Ficticio', motivo: 'Salário base não informado' },
                { funcionarioId: semSalario, nome: 'Sem Salario Ficticio', motivo: 'Salário base não informado' },
            ]);
            assert.deepEqual((await consultar(rh)).corpo.pendencias, folha.pendencias, 'a consulta devolve as mesmas pendências');
            assert.equal(folha.totais.bruto, 3000);
        });

        it('reprocessar a folha aberta reflete o cadastro de agora e limpa a pendência resolvida', async () => {
            const { empresaId, rh } = await cenario();
            const pessoa = await criarFuncionario(pool, empresaId, { nome: 'Pessoa Ficticia', salario: null });
            assert.equal(((await processar(rh)).corpo as FolhaDaCompetencia).pendencias.length, 1);

            await pool.query('UPDATE funcionarios SET salario_base = 2900 WHERE id = ?', [pessoa]);
            const folha = (await processar(rh)).corpo as FolhaDaCompetencia;
            assert.deepEqual(folha.pendencias, []);
            assert.equal(itemDe(folha, pessoa).totalDeductions, 236.69);
        });

        it('processa competências diferentes de forma independente', async () => {
            const { empresaId, rh } = await cenario();
            await criarFuncionario(pool, empresaId, { nome: 'Pessoa Ficticia', salario: 3000 });
            assert.equal((await processar(rh, '2026-08')).status, 201);
            assert.equal((await processar(rh, '2026-09')).status, 201);
            assert.equal((await consultar(rh, '2026-08')).corpo.competencia, '2026-08');
            assert.equal((await consultar(rh, '2026-10')).status, 404);
        });

        it('dois processamentos simultâneos geram uma só folha, sem erro', async () => {
            const { empresaId, rh } = await cenario();
            await criarFuncionario(pool, empresaId, { nome: 'Pessoa Ficticia', salario: 3000 });
            const respostas = await Promise.all([processar(rh), processar(rh), processar(rh)]);
            assert.deepEqual(respostas.map((r) => r.status).sort(), [200, 200, 201]);
            const [[{ folhas }]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS folhas FROM folhas WHERE empresa_id = ?', [empresaId]);
            const [[{ itens }]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS itens FROM folha_itens WHERE empresa_id = ?', [empresaId]);
            assert.equal(folhas, 1);
            assert.equal(itens, 1);
        });
    });

    describe('fechar', () => {
        it('POST fechar trava a folha: processar de novo e fechar de novo respondem 409', async () => {
            const { empresaId, rh } = await cenario();
            await criarFuncionario(pool, empresaId, { nome: 'Pessoa Ficticia', salario: 3000 });
            await processar(rh);

            const fechamento = await fechar(rh);
            assert.equal(fechamento.status, 200);
            assert.equal(fechamento.corpo.status, 'fechada');
            assert.ok(fechamento.corpo.fechadaEm);

            const reprocesso = await processar(rh);
            assert.equal(reprocesso.status, 409);
            assert.match(reprocesso.corpo.erro, /fechada/);
            assert.equal((await fechar(rh)).status, 409);
            assert.equal((await consultar(rh)).corpo.status, 'fechada');
        });

        it('fechar uma competência nunca processada responde 404', async () => {
            const { rh } = await cenario();
            assert.equal((await fechar(rh)).status, 404);
        });

        it('registra quem fechou e quando', async () => {
            const { empresaId, rh } = await cenario();
            await criarFuncionario(pool, empresaId, { nome: 'Pessoa Ficticia', salario: 3000 });
            await processar(rh);
            await fechar(rh);
            const [[folha]] = await pool.query<RowDataPacket[]>(
                `SELECT f.status, f.fechada_em, u.perfil FROM folhas f JOIN usuarios u ON u.id = f.fechada_por WHERE f.empresa_id = ?`, [empresaId]
            );
            assert.equal(folha.status, 'fechada');
            assert.equal(folha.perfil, 'RH');
            assert.ok(folha.fechada_em);
        });

        it('exige razão social e CNPJ da empresa: eles saem no holerite e não podem faltar num mês fechado', async () => {
            const { empresaId, rh } = await cenario({ comDadosLegais: false });
            await criarFuncionario(pool, empresaId, { nome: 'Pessoa Ficticia', salario: 3000 });
            const processada = await processar(rh);
            assert.deepEqual(processada.corpo.empresa, { razaoSocial: null, cnpj: null });

            const recusa = await fechar(rh);
            assert.equal(recusa.status, 422);
            assert.match(recusa.corpo.erro, /razão social e o CNPJ/);
            assert.equal((await consultar(rh)).corpo.status, 'aberta');

            await pool.query('UPDATE empresas SET razao_social = ?, cnpj = ? WHERE id = ?', ['Razao Social Preenchida Ltda', novoCnpj(), empresaId]);
            assert.equal((await fechar(rh)).status, 200);
        });

        it('após fechar, mudar salário, nome, cargo ou dados da empresa não altera o holerite da competência', async () => {
            const { empresaId, rh, razaoSocial, cnpj } = await cenario();
            const colaborador = await criarColaborador(pool, empresaId, { nome: 'Antes Ficticio', salario: 2900, contrato: 'CLT' });
            await processar(rh);
            await fechar(rh);
            const antes = (await meuHolerite(colaborador.token)).corpo as HoleritePublicado;
            const folhaAntes = (await consultar(rh)).corpo;
            assert.equal(antes.baseSalary, 2900);
            assert.equal(antes.totalDeductions, 236.69);

            await pool.query("UPDATE funcionarios SET salario_base = 8000, nome = 'Depois Ficticio', tipo_contrato = 'PJ', cargo_id = NULL WHERE id = ?", [colaborador.funcionarioId]);
            await pool.query('UPDATE empresas SET razao_social = ?, cnpj = ? WHERE id = ?', ['Outra Razao Social Ltda', novoCnpj(), empresaId]);

            assert.deepEqual((await meuHolerite(colaborador.token)).corpo, antes);
            assert.deepEqual((await consultar(rh)).corpo, folhaAntes);
            assert.deepEqual(antes.empresa, { razaoSocial, cnpj });
            assert.equal((await processar(rh)).status, 409, 'e o recálculo está barrado');
            assert.equal(antes.name, 'Antes Ficticio');
        });

        it('a folha aberta, ao contrário da fechada, acompanha o cadastro quando reprocessada', async () => {
            const { empresaId, rh } = await cenario();
            const colaborador = await criarColaborador(pool, empresaId, { nome: 'Pessoa Ficticia', salario: 2900 });
            await processar(rh);
            await pool.query('UPDATE funcionarios SET salario_base = 8000 WHERE id = ?', [colaborador.funcionarioId]);
            assert.equal(itemDe((await consultar(rh)).corpo, colaborador.funcionarioId).baseSalary, 2900, 'sem reprocessar, a folha é a conferida');
            assert.equal(itemDe((await processar(rh)).corpo, colaborador.funcionarioId).baseSalary, 8000);
        });
    });

    describe('holerite do colaborador', () => {
        it('meu-holerite devolve só o do token, com razão social e CNPJ da empresa dele', async () => {
            const { empresaId, rh, razaoSocial, cnpj } = await cenario();
            const ana = await criarColaborador(pool, empresaId, { nome: 'Ana Ficticia', salario: 2900 });
            const bruno = await criarColaborador(pool, empresaId, { nome: 'Bruno Ficticio', salario: 6800 });
            await processar(rh);
            await fechar(rh);

            const deAna = await meuHolerite(ana.token);
            assert.equal(deAna.status, 200);
            const holerite = deAna.corpo as HoleritePublicado;
            assert.equal(holerite.id, String(ana.funcionarioId));
            assert.equal(holerite.name, 'Ana Ficticia');
            assert.equal(holerite.competencia, COMPETENCIA);
            assert.equal(holerite.baseSalary, 2900);
            assert.deepEqual(holerite.empresa, { razaoSocial, cnpj });
            assert.equal(JSON.stringify(deAna.corpo).includes('Bruno'), false);

            const deBruno = (await meuHolerite(bruno.token)).corpo as HoleritePublicado;
            assert.equal(deBruno.id, String(bruno.funcionarioId));
            assert.equal(deBruno.totalDeductions, 753.51);
        });

        it('o colaborador só vê folha fechada: a aberta é rascunho do RH', async () => {
            const { empresaId, rh } = await cenario();
            const ana = await criarColaborador(pool, empresaId, { nome: 'Ana Ficticia', salario: 2900 });
            await processar(rh);
            const aberta = await meuHolerite(ana.token);
            assert.equal(aberta.status, 404);
            assert.deepEqual((await chamar('GET', '/meus-holerites', ana.token)).corpo, []);
            await fechar(rh);
            assert.equal((await meuHolerite(ana.token)).status, 200);
        });

        it('meus-holerites lista os meses fechados do mais recente ao mais antigo', async () => {
            const { empresaId, rh } = await cenario();
            const ana = await criarColaborador(pool, empresaId, { nome: 'Ana Ficticia', salario: 2900 });
            for (const competencia of ['2026-08', '2026-10', '2026-09']) {
                await processar(rh, competencia);
                await fechar(rh, competencia);
            }
            await processar(rh, '2026-07');
            const lista = (await chamar('GET', '/meus-holerites', ana.token)).corpo as HoleritePublicado[];
            assert.deepEqual(lista.map((h) => h.competencia), ['2026-10', '2026-09', '2026-08']);
        });

        it('quem entrou depois não tem holerite dos meses anteriores', async () => {
            const { empresaId, rh } = await cenario();
            await criarFuncionario(pool, empresaId, { nome: 'Antiga Ficticia', salario: 3000 });
            await processar(rh, '2026-08');
            await fechar(rh, '2026-08');
            const nova = await criarColaborador(pool, empresaId, { nome: 'Nova Ficticia', salario: 3000 });
            assert.equal((await meuHolerite(nova.token, '2026-08')).status, 404);
        });

        it('exige a competência e recusa formato inválido', async () => {
            const { empresaId } = await cenario();
            const ana = await criarColaborador(pool, empresaId, { nome: 'Ana Ficticia', salario: 2900 });
            assert.equal((await chamar('GET', '/meu-holerite', ana.token)).status, 400);
            assert.equal((await meuHolerite(ana.token, '2026-13')).status, 400);
            assert.equal((await meuHolerite(ana.token, 'outubro')).status, 400);
        });

        it('usuário sem vínculo de colaborador recebe 404', async () => {
            const { rh } = await cenario();
            assert.equal((await meuHolerite(rh)).status, 404);
            assert.equal((await chamar('GET', '/meus-holerites', rh)).status, 404);
        });

        it('resolve a identidade pelo vínculo usuário/funcionário, não pelo id', async () => {
            const { empresaId, rh } = await cenario();
            // Os ids das duas tabelas são sequências independentes: força o id do usuário a ser o de OUTRO funcionário.
            const [[{ proximo }]] = await pool.query<RowDataPacket[]>('SELECT AUTO_INCREMENT AS proximo FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', ['usuarios']);
            let funcionarioComIdDoUsuario = 0;
            while (funcionarioComIdDoUsuario < proximo) {
                funcionarioComIdDoUsuario = await criarFuncionario(pool, empresaId, { nome: `Outro Ficticio ${funcionarioComIdDoUsuario}`, salario: 9000 });
            }
            const alvo = await criarColaborador(pool, empresaId, { nome: 'Alvo Ficticio', salario: 2900 });
            assert.equal(alvo.usuario.id, proximo);
            await processar(rh);
            await fechar(rh);
            const holerite = (await meuHolerite(alvo.token)).corpo as HoleritePublicado;
            assert.equal(holerite.name, 'Alvo Ficticio');
            assert.equal(holerite.baseSalary, 2900);
        });
    });

    describe('isolamento entre empresas e perfis', () => {
        it('a empresa Beta não lê, processa nem fecha a competência da Alfa', async () => {
            const alfa = await cenario();
            const beta = await cenario();
            const anaAlfa = await criarColaborador(pool, alfa.empresaId, { nome: 'Ana Alfa Ficticia', salario: 2900 });
            const evaBeta = await criarColaborador(pool, beta.empresaId, { nome: 'Eva Beta Ficticia', salario: 7400 });
            await processar(alfa.rh);
            await fechar(alfa.rh);

            assert.equal((await consultar(beta.rh)).status, 404, 'Beta não enxerga a folha da Alfa');
            assert.equal((await meuHolerite(evaBeta.token)).status, 404, 'a colaboradora Beta não vê holerite da Alfa');
            assert.equal((await fechar(beta.rh)).status, 404, 'Beta não fecha folha que não processou');

            const processadaPelaBeta = (await processar(beta.rh)).corpo as FolhaDaCompetencia;
            assert.equal(processadaPelaBeta.status, 'aberta');
            assert.deepEqual(processadaPelaBeta.itens.map((i) => i.name), ['Eva Beta Ficticia']);
            assert.equal(processadaPelaBeta.empresa.cnpj, beta.cnpj);

            const daAlfa = (await consultar(alfa.rh)).corpo as FolhaDaCompetencia;
            assert.equal(daAlfa.status, 'fechada');
            assert.deepEqual(daAlfa.itens.map((i) => i.name), ['Ana Alfa Ficticia']);
            assert.equal(daAlfa.empresa.cnpj, alfa.cnpj);
            assert.equal((await meuHolerite(anaAlfa.token)).corpo.empresa.cnpj, alfa.cnpj);
        });

        it('colaborador não consulta, processa nem fecha a folha da empresa', async () => {
            const { empresaId, rh } = await cenario();
            const ana = await criarColaborador(pool, empresaId, { nome: 'Ana Ficticia', salario: 2900 });
            await processar(rh);
            for (const [metodo, caminho] of [['GET', `/competencias/${COMPETENCIA}`], ['POST', `/competencias/${COMPETENCIA}/processar`], ['POST', `/competencias/${COMPETENCIA}/fechar`]]) {
                assert.equal((await chamar(metodo, caminho, ana.token)).status, 403, `${metodo} ${caminho}`);
            }
        });

        it('o Administrador também processa e fecha', async () => {
            const { empresaId } = await cenario();
            await criarFuncionario(pool, empresaId, { nome: 'Pessoa Ficticia', salario: 3000 });
            const admin = await criarUsuario(pool, { empresaId, perfil: 'Administrador' });
            assert.equal((await processar(admin.token)).status, 201);
            assert.equal((await fechar(admin.token)).status, 200);
        });

        it('sem sessão a API responde 401', async () => {
            assert.equal((await consultar('')).status, 401);
            assert.equal((await processar('')).status, 401);
        });
    });

    describe('competência', () => {
        it('recusa formato inválido, mês futuro e mês sem tabela de INSS com 400', async () => {
            const { rh } = await cenario();
            for (const invalida of ['2026-13', '2026-00', '2026-1', 'outubro', '2026-10-01']) {
                assert.equal((await processar(rh, invalida)).status, 400, invalida);
                assert.equal((await consultar(rh, invalida)).status, 400, invalida);
            }
            const futura = await processar(rh, '2999-12');
            assert.equal(futura.status, 400);
            assert.match(futura.corpo.erro, /ainda não começou/);
            const semTabela = await processar(rh, '2025-12');
            assert.equal(semTabela.status, 400);
            assert.match(semTabela.corpo.erro, /tabela de INSS/);
        });

        it('o mês corrente é o de Belém, no relógio do servidor', async () => {
            const original = relogio.agora;
            const { empresaId, rh } = await cenario();
            await criarFuncionario(pool, empresaId, { nome: 'Pessoa Ficticia', salario: 3000 });
            try {
                // Belém é UTC-3: 2026-11-01T02:00Z são 23h de 31/10 lá.
                relogio.agora = () => Date.parse('2026-11-01T02:00:00Z');
                assert.equal((await processar(rh, '2026-11')).status, 400, 'em Belém ainda é outubro');
                assert.equal((await processar(rh, '2026-10')).status, 201);
                relogio.agora = () => Date.parse('2026-11-01T03:00:00Z');
                assert.equal((await processar(rh, '2026-11')).status, 201, 'novembro começou em Belém');
            } finally {
                relogio.agora = original;
            }
        });
    });

    describe('schema', () => {
        it('o banco recusa item de folha de uma empresa ligado a colaborador de outra', async () => {
            const alfa = await cenario();
            const beta = await cenario();
            await criarFuncionario(pool, alfa.empresaId, { nome: 'Pessoa Ficticia', salario: 3000 });
            const intruso = await criarFuncionario(pool, beta.empresaId, { nome: 'Intruso Ficticio', salario: 3000 });
            await processar(alfa.rh);
            const [[{ id: folhaId }]] = await pool.query<RowDataPacket[]>('SELECT id FROM folhas WHERE empresa_id = ?', [alfa.empresaId]);
            await assert.rejects(
                pool.query(
                    `INSERT INTO folha_itens (folha_id, empresa_id, funcionario_id, nome, bruto, inss, liquido, encargos, rubricas)
                     VALUES (?, ?, ?, 'Intruso', 1, 0, 1, 0, '[]')`,
                    [folhaId, alfa.empresaId, intruso]
                ),
                (erro: { code?: string }) => erro.code === 'ER_NO_REFERENCED_ROW_2'
            );
        });

        it('quem tem holerite emitido não pode ser apagado', async () => {
            const { empresaId, rh } = await cenario();
            const pessoa = await criarFuncionario(pool, empresaId, { nome: 'Pessoa Ficticia', salario: 3000 });
            await processar(rh);
            await assert.rejects(
                pool.query('DELETE FROM funcionarios WHERE id = ?', [pessoa]),
                (erro: { code?: string }) => erro.code === 'ER_ROW_IS_REFERENCED_2'
            );
        });

        it('o banco recusa competência malformada e uma segunda folha para o mesmo mês', async () => {
            const { empresaId, rh } = await cenario();
            await processar(rh);
            const inserir = (competencia: string) => pool.query<ResultSetHeader>("INSERT INTO folhas (empresa_id, competencia, pendencias) VALUES (?, ?, '[]')", [empresaId, competencia]);
            await assert.rejects(inserir('2026-13'), (erro: { code?: string }) => erro.code === 'ER_CHECK_CONSTRAINT_VIOLATED');
            await assert.rejects(inserir(COMPETENCIA), (erro: { code?: string }) => erro.code === 'ER_DUP_ENTRY');
        });

        it('o banco recusa folha fechada sem data de fechamento', async () => {
            const { empresaId, rh } = await cenario();
            await processar(rh);
            await assert.rejects(
                pool.query("UPDATE folhas SET status = 'fechada' WHERE empresa_id = ?", [empresaId]),
                (erro: { code?: string }) => erro.code === 'ER_CHECK_CONSTRAINT_VIOLATED'
            );
        });
    });
});
