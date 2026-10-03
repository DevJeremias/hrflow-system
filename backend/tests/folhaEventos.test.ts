// IRRF, FGTS, eventos de folha e holerite em PDF (B-21), pela API inteira contra um MySQL real:
// o IRRF e o INSS de 6.800,00 e o efeito de dependente, faltas e horas extras vindas do ponto,
// lançamentos por colaborador, encargos por regime, e o PDF individual e em lote. As contas
// esperadas foram feitas à mão (ver docs/folha-irrf-exemplo-auditado.md). Banco em
// tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST os testes são marcados como ignorados.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { PDFParse } from 'pdf-parse';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import { subirServidor, pararServidor } from './support/servidor.ts';
import { criarEmpresa, criarFuncionario, criarColaborador } from './support/empresas.ts';
import pool from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import { relogio } from '../modules/ponto/index.ts';
import type { FolhaDaCompetencia, HoleriteDoColaborador, HoleritePublicado } from '../modules/folha/folha.service.ts';

const COMPETENCIA = '2026-10';
// Terça, 20 de outubro de 2026, meio-dia em Belém: do dia 1 ao 19 está encerrado.
const AGORA = Date.parse('2026-10-20T12:00:00-03:00');

describe('IRRF, FGTS, eventos e PDF da folha', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let baseUrl: string;
    const agoraOriginal = relogio.agora;

    const chamar = async (metodo: string, caminho: string, token: string | null, corpo?: unknown) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        const binario = (resposta.headers.get('content-type') ?? '').includes('application/pdf');
        const texto = binario ? '' : await resposta.text();
        return { status: resposta.status, resposta, corpo: texto ? JSON.parse(texto) : undefined, pdf: binario ? Buffer.from(await resposta.arrayBuffer()) : undefined };
    };
    const folhaApi = (caminho = '') => `/api/folha/competencias/${COMPETENCIA}${caminho}`;
    const processar = (token: string) => chamar('POST', folhaApi('/processar'), token);
    const fechar = (token: string) => chamar('POST', folhaApi('/fechar'), token);
    const lancar = (token: string, funcionarioId: number, corpo: unknown) => chamar('PUT', folhaApi(`/lancamentos/${funcionarioId}`), token, corpo);

    // Uma empresa nova por cenário: a folha de uma competência é estado, e os cenários não dividem.
    const cenario = async (opcoes?: Parameters<typeof criarEmpresa>[1] & { regime?: string }) => {
        const empresa = await criarEmpresa(pool, opcoes);
        if (opcoes?.regime) await pool.query('UPDATE empresas SET regime_tributario = ? WHERE id = ?', [opcoes.regime, empresa.empresaId]);
        const rh = await criarUsuario(pool, { empresaId: empresa.empresaId, perfil: 'RH' });
        return { ...empresa, rh: rh.token };
    };
    const itemDe = (folha: FolhaDaCompetencia, funcionarioId: number): HoleriteDoColaborador => {
        const item = folha.itens.find((i) => i.id === String(funcionarioId));
        assert.ok(item, `holerite de ${funcionarioId} ausente da folha`);
        return item;
    };
    const descontoDe = (item: HoleriteDoColaborador, descricao: string) => item.deductionsList.find((linha) => linha.description === descricao);

    const instante = (dia: string, hora: string) => Date.parse(`${dia}T${hora}-03:00`) / 1000;
    const marcar = async (funcionarioId: number, empresaId: number, dia: string, marcas: Array<[string, string]>) => {
        for (const [tipo, hora] of marcas) {
            await pool.query(
                'INSERT INTO registro_pontos (funcionario_id, empresa_id, tipo_registro, data_hora_oficial) VALUES (?, ?, ?, FROM_UNIXTIME(?))',
                [funcionarioId, empresaId, tipo, instante(dia, hora)]
            );
        }
    };
    const diaCompleto = (funcionarioId: number, empresaId: number, dia: string) => marcar(funcionarioId, empresaId, dia, [
        ['Entrada', '08:00:00'], ['Pausa Almoço', '12:00:00'], ['Retorno Almoço', '13:00:00'], ['Saída', '17:00:00'],
    ]);
    // Dias úteis de 1 a 19 de outubro de 2026 (quinta a segunda): 1, 2, 5 a 9, 12 a 16 e 19.
    const DIAS_UTEIS = ['01', '02', '05', '06', '07', '08', '09', '12', '13', '14', '15', '16', '19'].map((dia) => `2026-10-${dia}`);

    const textoDoPdf = async (pdf: Buffer) => {
        const leitor = new PDFParse({ data: new Uint8Array(pdf) });
        try {
            const { pages } = await leitor.getText();
            return pages.map((pagina) => pagina.text.replace(/\s+/g, ' '));
        } finally {
            await leitor.destroy();
        }
    };

    before(async () => {
        await banco.preparar();
        relogio.agora = () => AGORA;
        servidor = (await subirServidor(criarApp())).server;
        baseUrl = `http://127.0.0.1:${(servidor.address() as import('node:net').AddressInfo).port}`;
    });

    after(async () => {
        relogio.agora = agoraOriginal;
        await pararServidor(servidor);
        await pool.end();
        await banco.encerrar();
    });

    describe('IRRF e INSS', () => {
        it('para 6.800,00 sem dependentes a API devolve INSS 753,51 e IRRF 680,82, e dependente reduz a base', async () => {
            const { empresaId, rh } = await cenario();
            const caio = await criarFuncionario(pool, empresaId, { nome: 'Caio Ficticio', salario: 6800 });

            const sem = itemDe((await processar(rh)).corpo, caio);
            assert.deepEqual([sem.inss, sem.irrf, sem.bases?.irrf, sem.dependents], [753.51, 680.82, 6046.49, 0]);
            assert.equal(sem.netSalary, 5365.67);
            assert.equal(descontoDe(sem, 'IRRF')?.value, 680.82);

            const criado = await chamar('POST', `/api/funcionarios/${caio}/dependentes`, rh, { nome: 'Filha Ficticia', parentesco: 'Filho(a)', data_nascimento: '2018-05-20' });
            assert.equal(criado.status, 201);
            const com = itemDe((await processar(rh)).corpo, caio);
            // Base 6.800,00 - 753,51 - 189,59 = 5.856,90; imposto 701,92 menos a redução de 73,23.
            assert.deepEqual([com.inss, com.irrf, com.bases?.irrf, com.dependents], [753.51, 628.69, 5856.9, 1]);
            assert.ok(com.irrf < sem.irrf);

            assert.equal((await chamar('DELETE', `/api/funcionarios/${caio}/dependentes/${criado.corpo.id}`, rh)).status, 204);
            assert.equal(itemDe((await processar(rh)).corpo, caio).irrf, 680.82);
        });

        it('FGTS aparece como encargo e não como desconto, e os totais da folha o somam', async () => {
            const { empresaId, rh } = await cenario();
            const caio = await criarFuncionario(pool, empresaId, { nome: 'Caio Ficticio', salario: 6800 });
            const dora = await criarFuncionario(pool, empresaId, { nome: 'Dora Ficticia', salario: 2900 });

            const folha = (await processar(rh)).corpo as FolhaDaCompetencia;
            const item = itemDe(folha, caio);
            assert.equal(item.fgts, 544);
            assert.deepEqual(item.chargesList.map((linha) => [linha.description, linha.value]), [
                ['FGTS', 544], ['INSS patronal (CPP)', 1360], ['RAT/SAT', 136], ['Terceiros (Sistema S e salário-educação)', 394.4],
            ]);
            assert.equal(item.deductionsList.some((linha) => linha.description.includes('FGTS')), false);
            assert.equal(item.employerCharges, 2434.4);
            assert.equal(item.netSalary, 6800 - 753.51 - 680.82, 'o FGTS não sai do líquido');
            assert.equal(itemDe(folha, dora).irrf, 0);
            assert.deepEqual(folha.totais, { bruto: 9700, descontos: 1671.02, liquido: 8028.98, encargos: 3472.6, inss: 990.2, irrf: 680.82, fgts: 776 });
        });

        it('o regime tributário da empresa define os encargos e a folha o guarda: mudá-lo depois não reescreve o mês fechado', async () => {
            const { empresaId, rh } = await cenario({ regime: 'Simples Nacional' });
            const caio = await criarFuncionario(pool, empresaId, { nome: 'Caio Ficticio', salario: 6800 });

            const aberta = (await processar(rh)).corpo as FolhaDaCompetencia;
            assert.equal(aberta.regimeTributario, 'Simples Nacional');
            assert.deepEqual(itemDe(aberta, caio).chargesList.map((linha) => linha.description), ['FGTS']);
            assert.equal(itemDe(aberta, caio).employerCharges, 544);

            await pool.query("UPDATE empresas SET regime_tributario = 'Lucro Real' WHERE id = ?", [empresaId]);
            const fechada = (await fechar(rh)).corpo as FolhaDaCompetencia;
            assert.equal(fechada.regimeTributario, 'Simples Nacional', 'fechar não recalcula nada');
            assert.equal(itemDe(fechada, caio).employerCharges, 544);
            assert.equal((await processar(rh)).status, 409);
            assert.equal(itemDe((await chamar('GET', folhaApi(), rh)).corpo, caio).employerCharges, 544);
        });

        it('sem regime informado valem os 27,8% de sempre mais o FGTS, e a folha devolve o regime nulo', async () => {
            const { empresaId, rh } = await cenario();
            const caio = await criarFuncionario(pool, empresaId, { nome: 'Caio Ficticio', salario: 2770 });
            const folha = (await processar(rh)).corpo as FolhaDaCompetencia;
            assert.equal(folha.regimeTributario, null);
            assert.equal(itemDe(folha, caio).employerCharges, 991.66);
        });

        it('PJ e estágio não têm IRRF nem FGTS; o temporário segue a regra geral', async () => {
            const { empresaId, rh } = await cenario();
            const pj = await criarFuncionario(pool, empresaId, { nome: 'Pj Ficticio', salario: 8000, contrato: 'PJ' });
            const estagio = await criarFuncionario(pool, empresaId, { nome: 'Estagio Ficticio', salario: 3000, contrato: 'Estágio' });
            const temporario = await criarFuncionario(pool, empresaId, { nome: 'Temporario Ficticio', salario: 6800, contrato: 'Temporário' });
            const folha = (await processar(rh)).corpo as FolhaDaCompetencia;
            for (const id of [pj, estagio]) {
                const item = itemDe(folha, id);
                assert.deepEqual([item.inss, item.irrf, item.fgts, item.employerCharges, item.chargesList.length], [0, 0, 0, 0, 0]);
            }
            assert.equal(itemDe(folha, temporario).irrf, 680.82);
        });

        it('folha emitida antes do IRRF continua legível: sem bases, IRRF e FGTS zerados', async () => {
            const { empresaId, rh } = await cenario();
            const caio = await criarFuncionario(pool, empresaId, { nome: 'Caio Ficticio', salario: 6800 });
            await processar(rh);
            await pool.query('UPDATE folha_itens SET irrf = 0, fgts = 0, bases = NULL, lancamentos = NULL WHERE funcionario_id = ?', [caio]);
            const item = itemDe((await chamar('GET', folhaApi(), rh)).corpo, caio);
            assert.deepEqual([item.irrf, item.fgts, item.bases, item.lancamentos], [0, 0, null, { adiantamento: 0, valeTransporte: 0, valeRefeicao: 0, planoSaude: 0 }]);
        });
    });

    describe('faltas e horas extras vindas do ponto', () => {
        it('a folha desconta a falta apurada e paga as horas extras, a 50% em dia útil e a 100% no domingo', async () => {
            const { empresaId, rh } = await cenario({ regime: 'Simples Nacional' });
            const ana = await criarFuncionario(pool, empresaId, { nome: 'Ana Ficticia', salario: 4000, admissao: '2024-01-02' });
            // Presente todos os dias úteis, menos a quinta 08 (falta). Segunda 05 ficou até 19:00 (2 h extras) e
            // domingo 04 trabalhou 2 h (hora extra a 100%).
            for (const dia of DIAS_UTEIS.filter((d) => d !== '2026-10-08' && d !== '2026-10-05')) await diaCompleto(ana, empresaId, dia);
            await marcar(ana, empresaId, '2026-10-05', [['Entrada', '08:00:00'], ['Pausa Almoço', '12:00:00'], ['Retorno Almoço', '13:00:00'], ['Saída', '19:00:00']]);
            await marcar(ana, empresaId, '2026-10-04', [['Entrada', '09:00:00'], ['Saída', '11:00:00']]);

            const item = itemDe((await processar(rh)).corpo, ana);
            // Hora de 20,00 (4.000 / 200): 2 h x 20 x 1,5 = 60,00 e 2 h x 20 x 2 = 80,00; a falta é 4.000 / 30 = 133,33.
            assert.deepEqual(item.earningsList.map((l) => [l.description, l.value, l.reference]), [['Horas extras 50%', 60, '02:00'], ['Horas extras 100%', 80, '02:00']]);
            assert.deepEqual(descontoDe(item, 'Faltas'), { description: 'Faltas', value: 133.33, isPercentage: false, reference: '1 dia' });
            // Remuneração 4.000 + 140 - 133,33 = 4.006,67: INSS 369,40 e IRRF zero (a redução cobre o imposto).
            assert.deepEqual([item.inss, item.irrf, item.fgts], [369.4, 0, 320.53]);
            assert.deepEqual([item.totalGross, item.totalDeductions, item.netSalary], [4140, 502.73, 3637.27]);
            assert.equal(item.bases?.fgts, 4006.67);
        });

        it('justificativa aprovada abona a falta, e quem não tem nenhuma marcação no mês não leva desconto', async () => {
            const { empresaId, rh } = await cenario();
            const bia = await criarFuncionario(pool, empresaId, { nome: 'Bia Ficticia', salario: 3000, admissao: '2024-01-02' });
            const sem = await criarFuncionario(pool, empresaId, { nome: 'Sem Ponto Ficticio', salario: 3000, admissao: '2024-01-02' });
            for (const dia of DIAS_UTEIS.filter((d) => d !== '2026-10-08')) await diaCompleto(bia, empresaId, dia);

            const antes = (await processar(rh)).corpo as FolhaDaCompetencia;
            assert.equal(descontoDe(itemDe(antes, bia), 'Faltas')?.value, 100);
            assert.equal(descontoDe(itemDe(antes, sem), 'Faltas'), undefined, 'sem marcações no mês não há como saber se faltou');

            await pool.query("INSERT INTO justificativas_ponto (funcionario_id, empresa_id, data_referencia, texto, status) VALUES (?, ?, '2026-10-08', 'Consulta medica', 'aprovada')", [bia, empresaId]);
            const depois = (await processar(rh)).corpo as FolhaDaCompetencia;
            assert.equal(descontoDe(itemDe(depois, bia), 'Faltas'), undefined);
        });

        it('quem foi desligado no mês não leva falta dos dias seguintes ao desligamento', async () => {
            const { empresaId, rh } = await cenario();
            const caio = await criarFuncionario(pool, empresaId, { nome: 'Caio Ficticio', salario: 3000, admissao: '2024-01-02', status: 'Inativo', desligamento: '2026-10-02' });
            await diaCompleto(caio, empresaId, '2026-10-01');
            await diaCompleto(caio, empresaId, '2026-10-02');
            assert.equal(descontoDe(itemDe((await processar(rh)).corpo, caio), 'Faltas'), undefined);
        });
    });

    describe('lançamentos por colaborador', () => {
        const LANCAMENTOS = { adiantamento: 300, valeTransporte: 500, valeRefeicao: 100, planoSaude: 80.5 };

        it('PUT lança adiantamento, VT, VR e plano de saúde e recalcula só o holerite do colaborador', async () => {
            const { empresaId, rh } = await cenario();
            const ana = await criarFuncionario(pool, empresaId, { nome: 'Ana Ficticia', salario: 4000 });
            const bia = await criarFuncionario(pool, empresaId, { nome: 'Bia Ficticia', salario: 3000 });
            await processar(rh);

            const resposta = await lancar(rh, ana, LANCAMENTOS);
            assert.equal(resposta.status, 200, JSON.stringify(resposta.corpo));
            const item = resposta.corpo as HoleriteDoColaborador;
            assert.deepEqual(item.lancamentos, LANCAMENTOS);
            // O vale-transporte desconta o menor entre o custo (500,00) e 6% do salário (240,00).
            const descontos = Object.fromEntries(item.deductionsList.map((l) => [l.description, l.value]));
            assert.deepEqual(descontos, { 'Desconto INSS': 368.6, 'Adiantamento salarial': 300, 'Vale-transporte': 240, 'Vale-refeição': 100, 'Plano de saúde': 80.5 });
            // Esses descontos não são dedutíveis: o IRRF e as bases são as de sempre.
            assert.deepEqual([item.irrf, item.bases?.irrf], [0, 3392.8]);
            assert.equal(item.netSalary, 4000 - 368.6 - 300 - 240 - 100 - 80.5);

            const folha = (await chamar('GET', folhaApi(), rh)).corpo as FolhaDaCompetencia;
            assert.deepEqual(itemDe(folha, ana).lancamentos, LANCAMENTOS);
            assert.equal(itemDe(folha, ana).netSalary, item.netSalary);
            assert.equal(itemDe(folha, bia).totalDeductions, 248.6, 'o holerite dos outros não muda');
        });

        it('reprocessar a folha aberta parte dos lançamentos; um corpo sem campos zera todos', async () => {
            const { empresaId, rh } = await cenario();
            const ana = await criarFuncionario(pool, empresaId, { nome: 'Ana Ficticia', salario: 4000 });
            await processar(rh);
            await lancar(rh, ana, LANCAMENTOS);

            assert.deepEqual(itemDe((await processar(rh)).corpo, ana).lancamentos, LANCAMENTOS);

            const zerado = await lancar(rh, ana, {});
            assert.deepEqual(zerado.corpo.lancamentos, { adiantamento: 0, valeTransporte: 0, valeRefeicao: 0, planoSaude: 0 });
            assert.deepEqual(zerado.corpo.deductionsList.map((l: { description: string }) => l.description), ['Desconto INSS']);
        });

        it('a folha fechada não aceita lançamento, e o holerite do colaborador guarda o que foi lançado', async () => {
            const { empresaId, rh } = await cenario();
            const ana = await criarColaborador(pool, empresaId, { nome: 'Ana Ficticia', salario: 4000 });
            await processar(rh);
            await lancar(rh, ana.funcionarioId, { adiantamento: 300 });
            await fechar(rh);

            const recusado = await lancar(rh, ana.funcionarioId, { adiantamento: 1 });
            assert.equal(recusado.status, 409);
            assert.match(recusado.corpo.erro, /fechada/);
            const holerite = (await chamar('GET', `/api/folha/meu-holerite?competencia=${COMPETENCIA}`, ana.token)).corpo as HoleritePublicado;
            assert.equal(descontoDe(holerite, 'Adiantamento salarial')?.value, 300);
        });

        it('recusa lançamento sem folha, sem holerite do colaborador e de outra empresa', async () => {
            const alfa = await cenario();
            const beta = await cenario();
            const ana = await criarFuncionario(pool, alfa.empresaId, { nome: 'Ana Ficticia', salario: 4000 });
            const semSalario = await criarFuncionario(pool, alfa.empresaId, { nome: 'Sem Salario Ficticio', salario: null });

            assert.equal((await lancar(alfa.rh, ana, { adiantamento: 1 })).status, 404, 'a folha ainda não foi processada');
            await processar(alfa.rh);
            await processar(beta.rh);
            assert.equal((await lancar(alfa.rh, semSalario, { adiantamento: 1 })).status, 404, 'pendente não tem holerite');
            assert.equal((await lancar(beta.rh, ana, { adiantamento: 1 })).status, 404, 'colaborador de outra empresa');
            assert.equal((await lancar(alfa.rh, 999999999, { adiantamento: 1 })).status, 404);
        });

        it('descontos que superam os proventos são recusados e o holerite fica como estava', async () => {
            const { empresaId, rh } = await cenario();
            const ana = await criarFuncionario(pool, empresaId, { nome: 'Ana Ficticia', salario: 2000 });
            await processar(rh);
            const recusado = await lancar(rh, ana, { adiantamento: 5000 });
            assert.equal(recusado.status, 400);
            assert.match(recusado.corpo.erro, /superam os proventos/);
            assert.deepEqual(itemDe((await chamar('GET', folhaApi(), rh)).corpo, ana).lancamentos, { adiantamento: 0, valeTransporte: 0, valeRefeicao: 0, planoSaude: 0 });
        });

        it('reprocessar com descontos acima dos proventos deixa o colaborador nas pendências, sem holerite negativo', async () => {
            const { empresaId, rh } = await cenario();
            const ana = await criarFuncionario(pool, empresaId, { nome: 'Ana Ficticia', salario: 2000 });
            await processar(rh);
            await lancar(rh, ana, { adiantamento: 1500 });
            await pool.query('UPDATE funcionarios SET salario_base = 1000 WHERE id = ?', [ana]);
            const folha = (await processar(rh)).corpo as FolhaDaCompetencia;
            assert.deepEqual(folha.itens, []);
            assert.deepEqual(folha.pendencias, [{ funcionarioId: ana, nome: 'Ana Ficticia', motivo: 'Os descontos superam os proventos do mês' }]);
        });

        it('valida o corpo: valor negativo, texto, mais de duas casas e campo desconhecido', async () => {
            const { empresaId, rh } = await cenario();
            const ana = await criarFuncionario(pool, empresaId, { nome: 'Ana Ficticia', salario: 4000 });
            await processar(rh);
            for (const corpo of [{ adiantamento: -1 }, { valeRefeicao: 'muito' }, { planoSaude: 10.123 }, { adiantamento: 1e12 }, { bonus: 100 }]) {
                const res = await lancar(rh, ana, corpo);
                assert.equal(res.status, 400, JSON.stringify(corpo));
            }
            assert.equal((await lancar(rh, ana, { adiantamento: '150.50' })).corpo.lancamentos.adiantamento, 150.5);
            assert.equal((await lancar(rh, ana, { adiantamento: null, planoSaude: '' })).status, 200);
            assert.equal((await chamar('PUT', folhaApi('/lancamentos/abc'), rh, {})).status, 400);
            assert.equal((await chamar('PUT', '/api/folha/competencias/2026-13/lancamentos/1', rh, {})).status, 400);
        });
    });

    describe('dependentes', () => {
        it('o RH cadastra e remove dependentes de colaborador, e não os dele nem os de outro RH ou Administrador', async () => {
            const { empresaId, rh: tokenDoRh } = await cenario();
            const rita = await criarFuncionario(pool, empresaId, { nome: 'Rita RH Ficticia', salario: 5200 });
            const { token: tokenDaRita } = await criarUsuario(pool, { empresaId, perfil: 'RH', funcionarioId: rita });
            const outroRh = await criarFuncionario(pool, empresaId, { nome: 'Outro RH Ficticio', salario: 5200 });
            await criarUsuario(pool, { empresaId, perfil: 'RH', funcionarioId: outroRh });
            const admin = await criarUsuario(pool, { empresaId, perfil: 'Administrador' });
            const caio = await criarFuncionario(pool, empresaId, { nome: 'Caio Ficticio', salario: 6800 });
            assert.ok(tokenDoRh);

            const novo = { nome: 'Dependente Ficticio', parentesco: 'Cônjuge' };
            assert.equal((await chamar('POST', `/api/funcionarios/${rita}/dependentes`, tokenDaRita, novo)).status, 403, 'o RH não altera o próprio cadastro');
            assert.equal((await chamar('POST', `/api/funcionarios/${outroRh}/dependentes`, tokenDaRita, novo)).status, 403, 'nem o de outro RH');
            assert.equal((await chamar('POST', `/api/funcionarios/${outroRh}/dependentes`, admin.token, novo)).status, 201, 'o Administrador alcança todos');
            assert.equal((await chamar('GET', `/api/funcionarios/${rita}/dependentes`, tokenDaRita)).status, 200, 'ler vale para qualquer cadastro');

            const criado = await chamar('POST', `/api/funcionarios/${caio}/dependentes`, tokenDaRita, novo);
            assert.deepEqual(criado.corpo, { id: criado.corpo.id, nome: 'Dependente Ficticio', parentesco: 'Cônjuge', data_nascimento: null });
            assert.deepEqual((await chamar('GET', `/api/funcionarios/${caio}/dependentes`, tokenDaRita)).corpo, [criado.corpo]);
            assert.equal((await chamar('DELETE', `/api/funcionarios/${caio}/dependentes/${criado.corpo.id}`, tokenDaRita)).status, 204);
            assert.equal((await chamar('DELETE', `/api/funcionarios/${caio}/dependentes/${criado.corpo.id}`, tokenDaRita)).status, 404);
            assert.deepEqual((await chamar('GET', `/api/funcionarios/${caio}/dependentes`, tokenDaRita)).corpo, []);
        });

        it('valida o dependente e isola por empresa', async () => {
            const alfa = await cenario();
            const beta = await cenario();
            const caio = await criarFuncionario(pool, alfa.empresaId, { nome: 'Caio Ficticio', salario: 6800 });
            for (const corpo of [{ parentesco: 'Filho(a)' }, { nome: 'Fulano', parentesco: 'Tio' }, { nome: 'Fulano', parentesco: 'Filho(a)', data_nascimento: '2999-01-01' }, { nome: 'Fulano', parentesco: 'Filho(a)', extra: 1 }]) {
                assert.equal((await chamar('POST', `/api/funcionarios/${caio}/dependentes`, alfa.rh, corpo)).status, 400, JSON.stringify(corpo));
            }
            const criado = await chamar('POST', `/api/funcionarios/${caio}/dependentes`, alfa.rh, { nome: 'Filha Ficticia', parentesco: 'Filho(a)', data_nascimento: '2018-05-20' });
            assert.equal(criado.corpo.data_nascimento, '2018-05-20');
            assert.equal((await chamar('GET', `/api/funcionarios/${caio}/dependentes`, beta.rh)).status, 404);
            assert.equal((await chamar('POST', `/api/funcionarios/${caio}/dependentes`, beta.rh, { nome: 'Fulano', parentesco: 'Outro' })).status, 404);
            assert.equal((await chamar('DELETE', `/api/funcionarios/${caio}/dependentes/${criado.corpo.id}`, beta.rh)).status, 404);
            const [[{ total }]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM dependentes WHERE funcionario_id = ?', [caio]);
            assert.equal(total, 1);
        });

        it('excluir o cadastro do colaborador leva os dependentes junto', async () => {
            const { empresaId, rh } = await cenario();
            const caio = await criarFuncionario(pool, empresaId, { nome: 'Caio Ficticio', salario: 6800 });
            await chamar('POST', `/api/funcionarios/${caio}/dependentes`, rh, { nome: 'Filha Ficticia', parentesco: 'Filho(a)' });
            assert.equal((await chamar('DELETE', `/api/funcionarios/${caio}`, rh)).status, 200);
            const [[{ total }]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM dependentes WHERE funcionario_id = ?', [caio]);
            assert.equal(total, 0);
        });
    });

    describe('PDF dos holerites', () => {
        const cabecalhoDoPdf = (pdf: Buffer) => pdf.subarray(0, 5).toString();

        it('GET holerites.pdf devolve um PDF com uma página por colaborador, com empresa, CNPJ, competência, rubricas e totais', async () => {
            const { empresaId, rh, razaoSocial, cnpj } = await cenario();
            const caio = await criarFuncionario(pool, empresaId, { nome: 'Caio Ficticio', salario: 6800 });
            await criarFuncionario(pool, empresaId, { nome: 'Dora Ficticia', salario: 2900 });
            await criarFuncionario(pool, empresaId, { nome: 'Eva Ficticia', salario: 4000 });
            await criarFuncionario(pool, empresaId, { nome: 'Sem Salario Ficticio', salario: null });
            await processar(rh);

            const resposta = await chamar('GET', folhaApi('/holerites.pdf'), rh);
            assert.equal(resposta.status, 200);
            assert.equal(resposta.resposta.headers.get('content-type'), 'application/pdf');
            assert.match(resposta.resposta.headers.get('content-disposition') ?? '', /^attachment; filename="holerites-2026-10\.pdf"$/);
            assert.equal(cabecalhoDoPdf(resposta.pdf!), '%PDF-');

            const paginas = await textoDoPdf(resposta.pdf!);
            assert.equal(paginas.length, 3, 'uma página por colaborador na folha; quem está nas pendências não tem página');
            assert.deepEqual(paginas.map((p) => /\d{4} - ([\wÀ-ÿ ]+?) (CARGO|Cargo)/.exec(p)?.[1]), ['Caio Ficticio', 'Dora Ficticia', 'Eva Ficticia']);
            const caioPagina = paginas[0];
            const cnpjFormatado = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
            for (const esperado of [
                razaoSocial.toUpperCase(), `CNPJ: ${cnpjFormatado}`, 'Referência: Outubro de 2026', 'Salário Base', 'Desconto INSS R$ 753,51', 'IRRF R$ 680,82',
                'R$ 6.800,00', 'R$ 1.434,33', 'R$ 5.365,67', 'FGTS DO MÊS R$ 544,00', 'BASE IRRF R$ 6.046,49', String(caio).padStart(4, '0'),
            ]) {
                assert.ok(caioPagina.includes(esperado), `a página de Caio não tem "${esperado}": ${caioPagina}`);
            }
            assert.ok(caioPagina.includes('Folha em conferência'), 'folha aberta sai marcada como em conferência');
            assert.equal(paginas.slice(1).some((p) => p.includes('Caio')), false);
        });

        it('o PDF individual traz só o colaborador pedido, e a folha fechada deixa de sair como em conferência', async () => {
            const { empresaId, rh } = await cenario();
            const caio = await criarFuncionario(pool, empresaId, { nome: 'Caio Ficticio', salario: 6800 });
            const dora = await criarFuncionario(pool, empresaId, { nome: 'Dora Ficticia', salario: 2900 });
            await processar(rh);
            await lancar(rh, dora, { planoSaude: 120 });
            await fechar(rh);

            const resposta = await chamar('GET', folhaApi(`/holerites/${dora}.pdf`), rh);
            assert.equal(resposta.status, 200);
            assert.match(resposta.resposta.headers.get('content-disposition') ?? '', /filename="holerite-2026-10-dora-ficticia\.pdf"/);
            const paginas = await textoDoPdf(resposta.pdf!);
            assert.equal(paginas.length, 1);
            assert.ok(paginas[0].includes('Dora Ficticia') && !paginas[0].includes('Caio'));
            assert.ok(paginas[0].includes('Plano de saúde R$ 120,00'));
            assert.equal(paginas[0].includes('Folha em conferência'), false);
            assert.equal((await chamar('GET', folhaApi(`/holerites/${caio}.pdf`), rh)).status, 200);
        });

        it('o colaborador baixa o próprio holerite em PDF, só de folha fechada', async () => {
            const { empresaId, rh } = await cenario();
            const ana = await criarColaborador(pool, empresaId, { nome: 'Ana Ficticia', salario: 2900 });
            const bruno = await criarColaborador(pool, empresaId, { nome: 'Bruno Ficticio', salario: 6800 });
            await processar(rh);
            const url = `/api/folha/meu-holerite.pdf?competencia=${COMPETENCIA}`;
            assert.equal((await chamar('GET', url, ana.token)).status, 404, 'a folha aberta é rascunho do RH');
            await fechar(rh);

            const deAna = await chamar('GET', url, ana.token);
            assert.equal(deAna.status, 200);
            const paginas = await textoDoPdf(deAna.pdf!);
            assert.equal(paginas.length, 1);
            assert.ok(paginas[0].includes('Ana Ficticia') && !paginas[0].includes('Bruno'));
            assert.ok(paginas[0].includes('Referência: Outubro de 2026'));
            assert.ok((await textoDoPdf((await chamar('GET', url, bruno.token)).pdf!))[0].includes('Bruno Ficticio'));
            assert.equal((await chamar('GET', '/api/folha/meu-holerite.pdf', ana.token)).status, 400, 'sem competência não há "mês atual"');
        });

        it('PDF de folha que não existe, sem holerites ou de colaborador fora dela responde 404 em JSON; e outra empresa não baixa', async () => {
            const alfa = await cenario();
            const beta = await cenario();
            const caio = await criarFuncionario(pool, alfa.empresaId, { nome: 'Caio Ficticio', salario: 6800 });
            const semSalario = await criarFuncionario(pool, alfa.empresaId, { nome: 'Sem Salario Ficticio', salario: null });

            assert.equal((await chamar('GET', folhaApi('/holerites.pdf'), alfa.rh)).status, 404, 'folha não processada');
            await processar(alfa.rh);
            await processar(beta.rh);
            const vazia = await chamar('GET', folhaApi('/holerites.pdf'), beta.rh);
            assert.equal(vazia.status, 404);
            assert.match(vazia.corpo.erro, /não tem holerites/);
            assert.equal((await chamar('GET', folhaApi(`/holerites/${semSalario}.pdf`), alfa.rh)).status, 404);
            assert.equal((await chamar('GET', folhaApi(`/holerites/${caio}.pdf`), beta.rh)).status, 404, 'colaborador de outra empresa');
            assert.equal((await chamar('GET', '/api/folha/competencias/2026-13/holerites.pdf', alfa.rh)).status, 400);
            assert.equal((await chamar('GET', folhaApi('/holerites/abc.pdf'), alfa.rh)).status, 400);
        });

        it('o PDF em lote suporta uma folha grande sem perder páginas', async () => {
            const { empresaId, rh } = await cenario();
            const valores = Array.from({ length: 60 }, (_, i) => [`Pessoa Lote ${String(i).padStart(2, '0')}`, `lote${process.pid}-${i}@exemplo.invalid`, 3000 + i * 10, 'CLT', 'Ativo', empresaId]);
            await pool.query<ResultSetHeader>('INSERT INTO funcionarios (nome, email, salario_base, tipo_contrato, status, empresa_id) VALUES ?', [valores]);
            await processar(rh);
            const paginas = await textoDoPdf((await chamar('GET', folhaApi('/holerites.pdf'), rh)).pdf!);
            assert.equal(paginas.length, 60);
            assert.ok(paginas[59].includes('Pessoa Lote 59'));
        });
    });
});
