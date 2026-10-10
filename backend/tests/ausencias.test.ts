// Férias e afastamentos de ponta a ponta contra a API: o colaborador pede, o RH decide, a situação do
// colaborador, a folha e o espelho de ponto refletem o período aprovado. Banco e variáveis em
// tests/support/bancoDeTeste.ts; sem HRFLOW_TEST_DB_HOST os testes são marcados como ignorados.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import type { RowDataPacket } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import { criarUsuario, cabecalhosDaSessao } from './support/sessao.ts';
import { criarEmpresa, criarFuncionario } from './support/empresas.ts';
import { subirServidor, pararServidor } from './support/servidor.ts';
import db from '../shared/db/pool.ts';
import { criarApp } from '../app.ts';
import { relogio } from '../modules/ponto/index.ts';
import { TAMANHO_MAXIMO_DO_ANEXO } from '../modules/ausencias/ausencias.anexo.ts';
import { calcularHolerite } from '../modules/folha/folha.regras.ts';

// Quinta-feira, 3 de outubro de 2026, meio-dia em Belém.
const HOJE = '2026-10-03';
const noDia = (dia: string) => { relogio.agora = () => Date.parse(`${dia}T15:00:00Z`); };

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('atestado ficticio')]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('imagem ficticia')]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('foto ficticia')]);

const anexo = (conteudo: Buffer = PDF, tipo = 'application/pdf', nome = 'atestado.pdf') => ({ nome, tipo, conteudo: conteudo.toString('base64') });

describe('férias e afastamentos', { skip: banco.skip }, () => {
    let servidor: http.Server;
    let baseUrl: string;
    let empresaA: number;
    let empresaB: number;
    const tokens = {} as Record<string, string>;
    const ids = {} as Record<string, number>;

    const chamar = async (metodo: string, caminho: string, token: string | undefined, corpo?: unknown) => {
        const resposta = await fetch(`${baseUrl}${caminho}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', ...cabecalhosDaSessao(token) },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        const texto = await resposta.text();
        return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, resposta };
    };

    const pedir = (token: string, corpo: Record<string, unknown>) =>
        chamar('POST', '/api/ausencias', token, { tipo: 'Férias', observacao: 'Descanso.', ...corpo });
    const decidir = (token: string, id: number, corpo: Record<string, unknown>) => chamar('PATCH', `/api/ausencias/${id}/decisao`, token, corpo);
    const minhas = async (token: string) => (await chamar('GET', '/api/ausencias/minhas', token)).corpo as Array<Record<string, any>>;

    // Cada teste que mexe nas ausências começa de uma tabela vazia, para o saldo e as sobreposições não vazarem.
    const limpar = () => db.query('DELETE FROM ausencias');
    const dataAtualDoBanco = async () => {
        const [[linha]] = await db.query<RowDataPacket[]>('SELECT DATE_FORMAT(CURRENT_DATE(), \'%Y-%m-%d\') AS hoje');
        return String(linha.hoje);
    };

    const colaborador = async (rotulo: string, empresaId: number, { admissao = '2024-01-15', salario = 3000, perfil = 'Colaborador' } = {}) => {
        const funcionarioId = await criarFuncionario(db, empresaId, { nome: `Pessoa ${rotulo}`, salario, admissao });
        const { token } = await criarUsuario(db, { empresaId, perfil, funcionarioId });
        tokens[rotulo] = token;
        ids[rotulo] = funcionarioId;
    };

    const situacaoNaLista = async (rotulo: string, token = tokens.Rita, filtro = '') => {
        const { corpo } = await chamar('GET', `/api/funcionarios?busca=${encodeURIComponent(`Pessoa ${rotulo}`)}${filtro}`, token);
        return (corpo as Array<{ status: string }>).map((f) => f.status);
    };

    before(async () => {
        await banco.preparar();
        servidor = (await subirServidor(criarApp())).server;
        baseUrl = `http://127.0.0.1:${(servidor.address() as import('node:net').AddressInfo).port}`;
        noDia(HOJE);

        empresaA = (await criarEmpresa(db)).empresaId;
        empresaB = (await criarEmpresa(db)).empresaId;
        // Dois períodos aquisitivos completos em 2026-10-03: 60 dias de direito.
        await colaborador('Caio', empresaA);
        await colaborador('Dora', empresaA, { admissao: '2026-02-01' });
        await colaborador('Rita', empresaA, { perfil: 'RH' });
        await colaborador('Outro RH', empresaA, { perfil: 'RH' });
        await colaborador('Eva', empresaB);
        await colaborador('RH da B', empresaB, { perfil: 'RH' });
        tokens.Administrador = (await criarUsuario(db, { empresaId: empresaA, perfil: 'Administrador' })).token;
        tokens['Admin com cadastro'] = (await criarUsuario(db, { empresaId: empresaA, perfil: 'Administrador', funcionarioId: await criarFuncionario(db, empresaA, { nome: 'Pessoa Admin', salario: 9000, admissao: '2020-01-02' }) })).token;
    });

    afterEach(() => { noDia(HOJE); });

    after(async () => {
        relogio.agora = () => Date.now();
        await pararServidor(servidor);
        await db.end();
        await banco.encerrar();
    });

    describe('o pedido do colaborador', () => {
        before(limpar);

        it('férias com anexo nascem pendentes e o colaborador as vê na própria lista', async () => {
            const feitoHoje = await dataAtualDoBanco();
            const { status, corpo } = await pedir(tokens.Caio, { inicio: '2026-10-19', fim: '2026-10-28', anexo: anexo() });
            assert.equal(status, 201);
            assert.deepEqual(
                { tipo: corpo.type, status: corpo.status, de: corpo.startDate, ate: corpo.endDate, dias: corpo.days, anexo: corpo.hasAttachment, nome: corpo.attachmentName, feito: corpo.requestDate, resposta: corpo.reply },
                { tipo: 'Férias', status: 'Pendente', de: '2026-10-19', ate: '2026-10-28', dias: 10, anexo: true, nome: 'atestado.pdf', feito: feitoHoje, resposta: null },
            );
            const lista = await minhas(tokens.Caio);
            assert.equal(lista.length, 1);
            assert.equal(lista[0].id, corpo.id);
            assert.equal(lista[0].status, 'Pendente');
        });

        it('o colaborador e a empresa vêm do token, não do corpo', async () => {
            const { status, corpo } = await pedir(tokens.Dora, { tipo: 'Outros', inicio: '2026-10-05', fim: '2026-10-05', funcionario_id: ids.Caio, empresa_id: empresaB });
            assert.equal(status, 201);
            const [[linha]] = await db.query<RowDataPacket[]>('SELECT funcionario_id, empresa_id FROM ausencias WHERE id = ?', [corpo.id]);
            assert.deepEqual({ ...linha }, { funcionario_id: ids.Dora, empresa_id: empresaA });
        });

        it('término antes do início responde 400', async () => {
            const { status, corpo } = await pedir(tokens.Caio, { inicio: '2026-11-10', fim: '2026-11-05' });
            assert.equal(status, 400);
            assert.match(corpo.erro, /término não pode ser anterior à data de início/);
        });

        it('datas que não existem, tipo desconhecido e motivo em branco respondem 400', async () => {
            for (const corpo of [
                { inicio: '2026-02-30', fim: '2026-03-05' },
                { inicio: 'amanhã', fim: '2026-11-05' },
                { inicio: '2026-11-01' },
                { inicio: '2026-11-01', fim: '2026-11-10', tipo: 'Sabático' },
                { inicio: '2026-11-01', fim: '2026-11-10', observacao: '   ' },
                { inicio: '2026-11-01', fim: '2026-11-10', observacao: 'x'.repeat(1001) },
            ]) {
                assert.equal((await pedir(tokens.Caio, corpo)).status, 400, JSON.stringify(corpo).slice(0, 80));
            }
        });

        it('anexo acima de 5 MB responde 400', async () => {
            const grande = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(TAMANHO_MAXIMO_DO_ANEXO)]);
            const { status, corpo } = await pedir(tokens.Caio, { tipo: 'Licença Médica', inicio: '2026-09-28', fim: '2026-09-30', anexo: anexo(grande) });
            assert.equal(status, 400);
            assert.match(corpo.erro, /no máximo 5 MB/);
        });

        it('um anexo de exatamente 5 MB é aceito', async () => {
            const exato = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(TAMANHO_MAXIMO_DO_ANEXO - 9)]);
            assert.equal(exato.length, TAMANHO_MAXIMO_DO_ANEXO);
            const { status } = await pedir(tokens.Caio, { tipo: 'Licença Médica', inicio: '2026-09-28', fim: '2026-09-30', anexo: anexo(exato) });
            assert.equal(status, 201);
        });

        it('um corpo absurdamente maior que o anexo permitido para no parser com 413', async () => {
            const { status, corpo } = await pedir(tokens.Caio, { tipo: 'Licença Médica', inicio: '2026-09-28', fim: '2026-09-30', anexo: { nome: 'a.pdf', tipo: 'application/pdf', conteudo: 'A'.repeat(15 * 1024 * 1024) } });
            assert.equal(status, 413);
            assert.match(corpo.erro, /excede o limite/);
        });

        it('anexo fora de PDF, JPG e PNG responde 400, inclusive quando o tipo declarado mente', async () => {
            const base = { tipo: 'Licença Médica', inicio: '2026-09-20', fim: '2026-09-21' };
            const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.from('imagem')]);
            for (const [rotulo, corpo] of [
                ['texto', anexo(Buffer.from('texto'), 'text/plain', 'a.txt')],
                ['gif', anexo(gif, 'image/gif', 'a.gif')],
                ['executável com tipo de PDF', anexo(Buffer.from('MZ\x90\x00executavel'), 'application/pdf', 'a.pdf')],
                ['PNG declarado como JPG', anexo(PNG, 'image/jpeg', 'a.jpg')],
                ['base64 inválido', { nome: 'a.pdf', tipo: 'application/pdf', conteudo: 'isto não é base64!' }],
                ['arquivo vazio', { nome: 'a.pdf', tipo: 'application/pdf', conteudo: '' }],
                ['sem nome', { nome: ' ', tipo: 'application/pdf', conteudo: PDF.toString('base64') }],
                ['sem tipo', { nome: 'a.pdf', conteudo: PDF.toString('base64') }],
            ] as const) {
                const resposta = await pedir(tokens.Caio, { ...base, anexo: corpo });
                assert.equal(resposta.status, 400, rotulo);
            }
        });

        it('PDF, JPG e PNG verdadeiros são aceitos', async () => {
            for (const [dia, arquivo] of [['2026-09-01', anexo(PDF)], ['2026-09-03', anexo(PNG, 'image/png', 'foto.png')], ['2026-09-05', anexo(JPG, 'image/jpeg', 'foto.jpg')]] as const) {
                assert.equal((await pedir(tokens.Caio, { tipo: 'Licença Médica', inicio: dia, fim: dia, anexo: arquivo })).status, 201, arquivo.tipo);
            }
        });

        it('a licença médica e o acidente de trabalho exigem anexo; a paternidade não', async () => {
            const medica = await pedir(tokens.Caio, { tipo: 'Licença Médica', inicio: '2026-08-10', fim: '2026-08-11' });
            assert.equal(medica.status, 400);
            assert.match(medica.corpo.erro, /atestado/);
            assert.equal((await pedir(tokens.Caio, { tipo: 'Acidente de Trabalho', inicio: '2026-08-10', fim: '2026-08-11' })).status, 400);
            assert.equal((await pedir(tokens.Caio, { tipo: 'Licença Paternidade', inicio: '2026-08-10', fim: '2026-08-14' })).status, 201);
        });

        it('férias não começam no passado e têm de 5 a 30 dias', async () => {
            assert.equal((await pedir(tokens.Caio, { inicio: '2026-10-02', fim: '2026-10-12' })).status, 400);
            assert.equal((await pedir(tokens.Caio, { inicio: '2026-12-01', fim: '2026-12-04' })).status, 400);
            assert.equal((await pedir(tokens.Caio, { inicio: '2026-12-01', fim: '2027-01-05' })).status, 400);
        });

        it('quem não tem cadastro de funcionário não pede nem lista', async () => {
            assert.equal((await pedir(tokens.Administrador, { inicio: '2026-12-01', fim: '2026-12-10' })).status, 403);
            assert.equal((await chamar('GET', '/api/ausencias/minhas', tokens.Administrador)).status, 403);
        });

        it('sem sessão responde 401', async () => {
            assert.equal((await chamar('GET', '/api/ausencias/minhas', undefined)).status, 401);
            assert.equal((await chamar('POST', '/api/ausencias', undefined, {})).status, 401);
        });
    });

    describe('saldo e período aquisitivo', () => {
        before(limpar);

        it('mostra o direito, o período em curso e quanto já foi pedido', async () => {
            const { status, corpo } = await chamar('GET', `/api/ausencias/saldo/${ids.Caio}`, tokens.Caio);
            assert.equal(status, 200);
            assert.deepEqual({ ...corpo }, {
                admissao: '2024-01-15',
                periodoAquisitivo: { inicio: '2026-01-15', fim: '2027-01-14' },
                periodosCompletos: 2,
                diasAdquiridos: 60,
                diasAprovados: 0,
                diasEmAnalise: 0,
                saldo: 60,
                prazoParaGozo: '2026-01-14',
                vencido: true,
            });
        });

        it('os dias pedidos saem do saldo e o que passa dele é recusado com 409', async () => {
            assert.equal((await pedir(tokens.Caio, { inicio: '2026-11-02', fim: '2026-11-21' })).status, 201);
            const { corpo } = await chamar('GET', `/api/ausencias/saldo/${ids.Caio}`, tokens.Caio);
            assert.equal(corpo.diasEmAnalise, 20);
            assert.equal(corpo.saldo, 40);

            assert.equal((await pedir(tokens.Caio, { inicio: '2026-12-01', fim: '2026-12-30' })).status, 201);
            const excedente = await pedir(tokens.Caio, { inicio: '2027-01-04', fim: '2027-01-15' });
            assert.equal(excedente.status, 409);
            assert.match(excedente.corpo.erro, /Saldo de férias insuficiente.*12 dias.*10 disponíveis/);
        });

        it('um pedido recusado devolve os dias ao saldo', async () => {
            const [pendente] = (await minhas(tokens.Caio)).filter((a) => a.startDate === '2026-12-01');
            assert.equal((await decidir(tokens.Rita, pendente.id, { status: 'Recusada', resposta: 'Fim de ano é pico.' })).status, 200);
            const { corpo } = await chamar('GET', `/api/ausencias/saldo/${ids.Caio}`, tokens.Caio);
            assert.equal(corpo.saldo, 40);
            assert.equal(corpo.diasEmAnalise, 20);
        });

        it('quem ainda não completou um ano de casa não pode pedir férias', async () => {
            const { corpo } = await chamar('GET', `/api/ausencias/saldo/${ids.Dora}`, tokens.Dora);
            assert.equal(corpo.saldo, 0);
            assert.equal(corpo.periodoAquisitivo.inicio, '2026-02-01');
            const pedido = await pedir(tokens.Dora, { inicio: '2026-11-02', fim: '2026-11-11' });
            assert.equal(pedido.status, 409);
            assert.match(pedido.corpo.erro, /Saldo de férias insuficiente/);
        });

        it('o saldo vale para a data de início: o direito que nasce antes das férias já conta', async () => {
            await db.query('UPDATE funcionarios SET data_admissao = ? WHERE id = ?', ['2025-12-01', ids.Dora]);
            assert.equal((await pedir(tokens.Dora, { inicio: '2026-11-02', fim: '2026-11-11' })).status, 409, 'o aniversário é depois das férias');
            assert.equal((await pedir(tokens.Dora, { inicio: '2026-12-07', fim: '2026-12-16' })).status, 201, 'o aniversário é antes das férias');
            await db.query('UPDATE funcionarios SET data_admissao = ? WHERE id = ?', ['2026-02-01', ids.Dora]);
        });

        it('sem data de admissão o saldo é zero e o pedido responde 409 com a causa', async () => {
            const semAdmissao = await criarFuncionario(db, empresaA, { nome: 'Pessoa Sem Admissao', salario: 2000, admissao: null });
            const { token } = await criarUsuario(db, { empresaId: empresaA, perfil: 'Colaborador', funcionarioId: semAdmissao });
            const { corpo } = await chamar('GET', `/api/ausencias/saldo/${semAdmissao}`, token);
            assert.deepEqual({ admissao: corpo.admissao, saldo: corpo.saldo, periodo: corpo.periodoAquisitivo }, { admissao: null, saldo: 0, periodo: null });
            const pedido = await pedir(token, { inicio: '2026-11-02', fim: '2026-11-11' });
            assert.equal(pedido.status, 409);
            assert.match(pedido.corpo.erro, /data de admissão não está cadastrada/);
        });

        it('um período que se sobrepõe a outro pedido, em análise ou aprovado, responde 409', async () => {
            const { status, corpo } = await pedir(tokens.Caio, { tipo: 'Licença Paternidade', inicio: '2026-11-20', fim: '2026-11-25' });
            assert.equal(status, 409);
            assert.match(corpo.erro, /cobre parte deste período/);
            // Já uma recusada não ocupa o calendário.
            assert.equal((await pedir(tokens.Caio, { tipo: 'Licença Paternidade', inicio: '2026-12-02', fim: '2026-12-04' })).status, 201);
        });

        it('o colaborador vê o saldo dele; o de outro colaborador é 403, e o RH vê o de qualquer um da empresa', async () => {
            assert.equal((await chamar('GET', `/api/ausencias/saldo/${ids.Caio}`, tokens.Dora)).status, 403);
            assert.equal((await chamar('GET', `/api/ausencias/saldo/${ids.Caio}`, tokens.Rita)).status, 200);
            assert.equal((await chamar('GET', `/api/ausencias/saldo/${ids.Caio}`, tokens.Administrador)).status, 200);
        });

        it('o saldo de um colaborador de outra empresa responde 404 ao RH', async () => {
            assert.equal((await chamar('GET', `/api/ausencias/saldo/${ids.Eva}`, tokens.Rita)).status, 404);
            assert.equal((await chamar('GET', `/api/ausencias/saldo/${ids.Caio}`, tokens['RH da B'])).status, 404);
        });
    });

    describe('a decisão do RH', () => {
        before(limpar);

        it('o RH vê a pendente com quem pediu, aprova, e o colaborador passa a ver "Aprovada"', async () => {
            const pedido = await pedir(tokens.Caio, { inicio: '2026-11-09', fim: '2026-11-18', anexo: anexo() });
            const fila = await chamar('GET', '/api/ausencias?status=Pendente', tokens.Rita);
            assert.equal(fila.status, 200);
            assert.equal(fila.resposta.headers.get('X-Total-Count'), '1');
            const [item] = fila.corpo;
            assert.deepEqual(
                { id: item.id, quem: item.employeeName, tipo: item.type, status: item.status, decide: item.canDecide, anexo: item.hasAttachment },
                { id: pedido.corpo.id, quem: 'Pessoa Caio', tipo: 'Férias', status: 'Pendente', decide: true, anexo: true },
            );

            const decisao = await decidir(tokens.Rita, pedido.corpo.id, { status: 'Aprovada' });
            assert.equal(decisao.status, 200);
            assert.equal(decisao.corpo.status, 'Aprovada');
            assert.match(decisao.corpo.decidedBy, /^Usuario Ficticio/);
            assert.equal((await minhas(tokens.Caio))[0].status, 'Aprovada');
            assert.equal((await chamar('GET', '/api/ausencias?status=Pendente', tokens.Rita)).corpo.length, 0);
        });

        it('um pedido decidido não é decidido de novo', async () => {
            const [aprovada] = await minhas(tokens.Caio);
            const { status, corpo } = await decidir(tokens.Rita, aprovada.id, { status: 'Recusada', resposta: 'Mudei de ideia.' });
            assert.equal(status, 409);
            assert.match(corpo.erro, /já foi decidida/);
        });

        it('recusar exige o motivo, que o colaborador lê', async () => {
            const pedido = await pedir(tokens.Caio, { tipo: 'Outros', inicio: '2026-12-10', fim: '2026-12-10' });
            const semMotivo = await decidir(tokens.Rita, pedido.corpo.id, { status: 'Recusada' });
            assert.equal(semMotivo.status, 400);
            assert.match(semMotivo.corpo.erro, /motivo da recusa/);
            assert.equal((await decidir(tokens.Rita, pedido.corpo.id, { status: 'Recusada', resposta: '   ' })).status, 400);
            const recusada = await decidir(tokens.Rita, pedido.corpo.id, { status: 'Recusada', resposta: 'Sem comprovante.' });
            assert.equal(recusada.status, 200);
            const doColaborador = (await minhas(tokens.Caio)).find((a) => a.id === pedido.corpo.id)!;
            assert.deepEqual({ status: doColaborador.status, resposta: doColaborador.reply }, { status: 'Recusada', resposta: 'Sem comprovante.' });
        });

        it('a decisão e o corpo inválidos respondem 400, e o pedido inexistente, 404', async () => {
            const pedido = await pedir(tokens.Caio, { tipo: 'Outros', inicio: '2026-12-11', fim: '2026-12-11' });
            for (const corpo of [{}, { status: 'Talvez' }, { status: 'Pendente' }, { status: 'aprovada' }]) {
                assert.equal((await decidir(tokens.Rita, pedido.corpo.id, corpo)).status, 400, JSON.stringify(corpo));
            }
            assert.equal((await decidir(tokens.Rita, 999999, { status: 'Aprovada' })).status, 404);
            assert.equal((await chamar('PATCH', '/api/ausencias/abc/decisao', tokens.Rita, { status: 'Aprovada' })).status, 400);
        });

        it('o colaborador não lê a fila nem decide', async () => {
            const pedido = await pedir(tokens.Caio, { tipo: 'Outros', inicio: '2026-12-14', fim: '2026-12-14' });
            assert.equal((await chamar('GET', '/api/ausencias', tokens.Caio)).status, 403);
            assert.equal((await decidir(tokens.Caio, pedido.corpo.id, { status: 'Aprovada' })).status, 403);
            assert.equal((await minhas(tokens.Caio)).find((a) => a.id === pedido.corpo.id)!.status, 'Pendente');
        });

        it('ninguém decide o próprio pedido, nem o Administrador com cadastro', async () => {
            const daRita = await pedir(tokens.Rita, { tipo: 'Outros', inicio: '2026-12-15', fim: '2026-12-15' });
            const recusa = await decidir(tokens.Rita, daRita.corpo.id, { status: 'Aprovada' });
            assert.equal(recusa.status, 403);
            assert.match(recusa.corpo.erro, /sua própria solicitação/);

            const doAdmin = await pedir(tokens['Admin com cadastro'], { tipo: 'Outros', inicio: '2026-12-15', fim: '2026-12-15' });
            assert.equal((await decidir(tokens['Admin com cadastro'], doAdmin.corpo.id, { status: 'Aprovada' })).status, 403);
        });

        it('o RH não decide o pedido de outro RH nem de Administrador; o Administrador decide', async () => {
            const daRita = (await minhas(tokens.Rita))[0];
            const fila = await chamar('GET', '/api/ausencias?status=Pendente', tokens['Outro RH']);
            const item = fila.corpo.find((a: { id: number }) => a.id === daRita.id);
            assert.equal(item.canDecide, false, 'a fila não oferece os botões');
            const recusa = await decidir(tokens['Outro RH'], daRita.id, { status: 'Aprovada' });
            assert.equal(recusa.status, 403);
            assert.match(recusa.corpo.erro, /Só um Administrador/);

            const doAdmin = (await minhas(tokens['Admin com cadastro']))[0];
            assert.equal((await decidir(tokens.Rita, doAdmin.id, { status: 'Aprovada' })).status, 403);

            assert.equal((await decidir(tokens.Administrador, daRita.id, { status: 'Aprovada' })).status, 200);
            assert.equal((await decidir(tokens.Administrador, doAdmin.id, { status: 'Recusada', resposta: 'Pede ao RH.' })).status, 200);
        });

        it('a fila filtra por status e por colaborador e pagina, com os pendentes primeiro', async () => {
            await limpar();
            const um = await pedir(tokens.Caio, { tipo: 'Outros', inicio: '2026-11-02', fim: '2026-11-02' });
            const dois = await pedir(tokens.Dora, { tipo: 'Outros', inicio: '2026-11-03', fim: '2026-11-03' });
            const tres = await pedir(tokens.Caio, { tipo: 'Outros', inicio: '2026-11-04', fim: '2026-11-04' });
            await decidir(tokens.Rita, um.corpo.id, { status: 'Aprovada' });

            const todas = await chamar('GET', '/api/ausencias', tokens.Rita);
            assert.deepEqual(todas.corpo.map((a: { id: number }) => a.id), [dois.corpo.id, tres.corpo.id, um.corpo.id], 'pendentes do mais antigo ao mais novo, depois as decididas');
            assert.equal(todas.resposta.headers.get('X-Total-Count'), '3');

            assert.deepEqual((await chamar('GET', '/api/ausencias?status=Aprovada', tokens.Rita)).corpo.map((a: { id: number }) => a.id), [um.corpo.id]);
            assert.deepEqual((await chamar('GET', `/api/ausencias?funcionarioId=${ids.Dora}`, tokens.Rita)).corpo.map((a: { id: number }) => a.id), [dois.corpo.id]);

            const pagina = await chamar('GET', '/api/ausencias?pagina=2&limite=2', tokens.Rita);
            assert.deepEqual(pagina.corpo.map((a: { id: number }) => a.id), [um.corpo.id]);
            assert.equal(pagina.resposta.headers.get('X-Total-Count'), '3');

            assert.equal((await chamar('GET', '/api/ausencias?status=Qualquer', tokens.Rita)).status, 400);
        });
    });

    describe('isolamento entre empresas e acesso ao anexo', () => {
        let pedidoDoCaio: number;
        let pedidoDaEva: number;

        before(async () => {
            await limpar();
            pedidoDoCaio = (await pedir(tokens.Caio, { tipo: 'Licença Médica', inicio: '2026-09-28', fim: '2026-09-30', anexo: anexo(PNG, 'image/png', 'receita.png') })).corpo.id;
            pedidoDaEva = (await pedir(tokens.Eva, { tipo: 'Licença Médica', inicio: '2026-09-28', fim: '2026-09-30', anexo: anexo() })).corpo.id;
        });

        it('GET /minhas não devolve ausência de outra empresa nem de outro colaborador', async () => {
            assert.deepEqual((await minhas(tokens.Caio)).map((a) => a.id), [pedidoDoCaio]);
            assert.deepEqual((await minhas(tokens.Eva)).map((a) => a.id), [pedidoDaEva]);
            assert.deepEqual((await minhas(tokens.Dora)).map((a) => a.id), []);
        });

        it('o RH só vê a fila da própria empresa', async () => {
            assert.deepEqual((await chamar('GET', '/api/ausencias', tokens.Rita)).corpo.map((a: { id: number }) => a.id), [pedidoDoCaio]);
            assert.deepEqual((await chamar('GET', '/api/ausencias', tokens['RH da B'])).corpo.map((a: { id: number }) => a.id), [pedidoDaEva]);
            assert.deepEqual((await chamar('GET', `/api/ausencias?funcionarioId=${ids.Eva}`, tokens.Rita)).corpo, []);
        });

        it('o RH de outra empresa não decide o pedido nem baixa o anexo', async () => {
            assert.equal((await decidir(tokens['RH da B'], pedidoDoCaio, { status: 'Aprovada' })).status, 404);
            assert.equal((await chamar('GET', `/api/ausencias/${pedidoDoCaio}/anexo`, tokens['RH da B'])).status, 404);
            assert.equal((await minhas(tokens.Caio))[0].status, 'Pendente');
        });

        it('o dono e o RH da empresa baixam o anexo como ele foi enviado', async () => {
            for (const rotulo of ['Caio', 'Rita', 'Administrador']) {
                const resposta = await fetch(`${baseUrl}/api/ausencias/${pedidoDoCaio}/anexo`, { headers: cabecalhosDaSessao(tokens[rotulo]) });
                assert.equal(resposta.status, 200, rotulo);
                assert.equal(resposta.headers.get('content-type'), 'image/png');
                assert.equal(resposta.headers.get('content-disposition'), "attachment; filename*=UTF-8''receita.png");
                assert.equal(resposta.headers.get('x-content-type-options'), 'nosniff');
                assert.deepEqual(Buffer.from(await resposta.arrayBuffer()), PNG);
            }
        });

        it('outro colaborador da mesma empresa não baixa o anexo, e quem não tem anexo recebe 404', async () => {
            assert.equal((await chamar('GET', `/api/ausencias/${pedidoDoCaio}/anexo`, tokens.Dora)).status, 404);
            const semAnexo = await pedir(tokens.Caio, { tipo: 'Outros', inicio: '2026-11-02', fim: '2026-11-02' });
            assert.equal((await chamar('GET', `/api/ausencias/${semAnexo.corpo.id}/anexo`, tokens.Caio)).status, 404);
            assert.equal((await chamar('GET', `/api/ausencias/${pedidoDoCaio}/anexo`, undefined)).status, 401);
        });

        it('o nome do arquivo não carrega caminho nem caracteres de controle', async () => {
            const { corpo } = await pedir(tokens.Dora, { tipo: 'Licença Médica', inicio: '2026-09-28', fim: '2026-09-29', anexo: anexo(PDF, 'application/pdf', '../../etc/atestado\n.pdf') });
            assert.equal(corpo.attachmentName, 'atestado.pdf');
        });
    });

    describe('LGPD: o atestado e o motivo são dado de saúde', () => {
        it('a exportação traz os pedidos sem o arquivo, e a anonimização apaga o motivo e o atestado e mantém período e decisão', async () => {
            await limpar();
            await colaborador('Gil', empresaA, { admissao: '2020-02-03' });
            const pedido = await pedir(tokens.Gil, { tipo: 'Licença Médica', inicio: '2026-09-28', fim: '2026-09-30', observacao: 'Cirurgia de joelho, CID M23.', anexo: anexo() });
            assert.equal((await decidir(tokens.Rita, pedido.corpo.id, { status: 'Recusada', resposta: 'Atestado ilegível: CID M23 sem carimbo.' })).status, 200);

            const exportacao = await chamar('GET', `/api/funcionarios/${ids.Gil}/exportar`, tokens.Administrador);
            assert.equal(exportacao.status, 200);
            const [exportado] = exportacao.corpo.ferias_e_afastamentos;
            assert.deepEqual(
                { tipo: exportado.tipo, observacao: exportado.observacao, anexo: exportado.anexo_nome, bytes: exportado.anexo_tamanho },
                { tipo: 'Licença Médica', observacao: 'Cirurgia de joelho, CID M23.', anexo: 'atestado.pdf', bytes: PDF.length },
            );
            assert.ok(!JSON.stringify(exportacao.corpo).includes(PDF.toString('base64')), 'o arquivo não vai no JSON');

            await db.query("UPDATE funcionarios SET status = 'Inativo', data_desligamento = '2026-10-01', motivo_desligamento = 'Teste' WHERE id = ?", [ids.Gil]);
            assert.equal((await chamar('POST', `/api/funcionarios/${ids.Gil}/anonimizar`, tokens.Administrador)).status, 200);

            const [[linha]] = await db.query<RowDataPacket[]>(
                "SELECT observacao, resposta, status, DATE_FORMAT(data_inicio, '%Y-%m-%d') AS inicio FROM ausencias WHERE funcionario_id = ?", [ids.Gil]);
            assert.deepEqual({ ...linha }, { observacao: '[removido na anonimização]', resposta: '[removido na anonimização]', status: 'Recusada', inicio: '2026-09-28' });
            const [anexos] = await db.query<RowDataPacket[]>('SELECT 1 FROM ausencia_anexos x JOIN ausencias a ON a.id = x.ausencia_id WHERE a.funcionario_id = ?', [ids.Gil]);
            assert.equal(anexos.length, 0, 'o atestado sai');
        });
    });

    describe('o que a ausência aprovada muda no sistema', () => {
        // Férias de 2026-10-05 a 2026-10-14 (10 dias), aprovadas.
        let feriasDoCaio: number;

        before(async () => {
            await limpar();
            feriasDoCaio = (await pedir(tokens.Caio, { inicio: '2026-10-05', fim: '2026-10-14' })).corpo.id;
        });

        it('pendente não muda a situação do colaborador', async () => {
            noDia('2026-10-07');
            assert.deepEqual(await situacaoNaLista('Caio'), ['Ativo']);
        });

        it('no primeiro dia de férias aprovadas o status vira Férias e, no dia seguinte ao fim, volta a Ativo', async () => {
            assert.equal((await decidir(tokens.Rita, feriasDoCaio, { status: 'Aprovada' })).status, 200);
            const situacaoEm = async (dia: string) => { noDia(dia); return situacaoNaLista('Caio'); };
            assert.deepEqual(await situacaoEm('2026-10-04'), ['Ativo'], 'véspera');
            assert.deepEqual(await situacaoEm('2026-10-05'), ['Férias'], 'primeiro dia');
            assert.deepEqual(await situacaoEm('2026-10-10'), ['Férias'], 'meio');
            assert.deepEqual(await situacaoEm('2026-10-14'), ['Férias'], 'último dia');
            assert.deepEqual(await situacaoEm('2026-10-15'), ['Ativo'], 'dia seguinte ao fim');
            const [[{ status }]] = await db.query<RowDataPacket[]>('SELECT status FROM funcionarios WHERE id = ?', [ids.Caio]);
            assert.equal(status, 'Ativo', 'a coluna não é reescrita: a situação é lida da ausência');
        });

        it('o relógio é o de Belém: às 23h de 04/10 em Belém ainda é a véspera', async () => {
            relogio.agora = () => Date.parse('2026-10-05T02:59:00Z');
            assert.deepEqual(await situacaoNaLista('Caio'), ['Ativo']);
            relogio.agora = () => Date.parse('2026-10-05T03:00:00Z');
            assert.deepEqual(await situacaoNaLista('Caio'), ['Férias']);
        });

        it('o filtro de status da lista vale para a situação de hoje', async () => {
            noDia('2026-10-10');
            const nomes = async (status: string) => ((await chamar('GET', `/api/funcionarios?status=${encodeURIComponent(status)}`, tokens.Rita)).corpo as Array<{ nome: string }>).map((f) => f.nome);
            assert.ok((await nomes('Férias')).includes('Pessoa Caio'));
            assert.ok(!(await nomes('Ativo')).includes('Pessoa Caio'));
            noDia('2026-10-20');
            assert.ok(!(await nomes('Férias')).includes('Pessoa Caio'));
            assert.ok((await nomes('Ativo')).includes('Pessoa Caio'));
        });

        it('uma licença aprovada põe o colaborador como Afastado, e o desligamento prevalece', async () => {
            const licenca = await pedir(tokens.Dora, { tipo: 'Licença Médica', inicio: '2026-10-01', fim: '2026-10-09', anexo: anexo() });
            assert.equal((await decidir(tokens.Rita, licenca.corpo.id, { status: 'Aprovada' })).status, 200);
            noDia('2026-10-03');
            assert.deepEqual(await situacaoNaLista('Dora'), ['Afastado']);
            assert.deepEqual(await situacaoNaLista('Dora', tokens.Rita, '&status=Afastado'), ['Afastado']);
            noDia('2026-10-10');
            assert.deepEqual(await situacaoNaLista('Dora'), ['Ativo']);

            noDia('2026-10-03');
            await db.query("UPDATE funcionarios SET status = 'Inativo', data_desligamento = '2026-10-02', motivo_desligamento = 'Teste' WHERE id = ?", [ids.Dora]);
            assert.deepEqual(await situacaoNaLista('Dora'), ['Inativo']);
            await db.query("UPDATE funcionarios SET status = 'Ativo', data_desligamento = NULL, motivo_desligamento = NULL WHERE id = ?", [ids.Dora]);
        });

        it('o tipo Outros não muda a situação', async () => {
            const abono = await pedir(tokens.Caio, { tipo: 'Outros', inicio: '2026-10-03', fim: '2026-10-03' });
            assert.equal((await decidir(tokens.Rita, abono.corpo.id, { status: 'Aprovada' })).status, 200);
            assert.deepEqual(await situacaoNaLista('Caio'), ['Ativo']);
        });

        it('a folha da competência paga o terço das férias dos dias que caem nela', async () => {
            noDia('2026-10-20');
            const processada = await chamar('POST', '/api/folha/competencias/2026-10/processar', tokens.Rita);
            assert.equal(processada.status, 201);
            const caio = processada.corpo.itens.find((i: { id: string }) => i.id === String(ids.Caio));
            // 10 dias: 3000 / 30 * 10 / 3 = 333,33, e o INSS incide sobre 3333,33.
            const esperado = calcularHolerite({ salario: 3000, dia: '2026-10-01', tipoContrato: 'CLT', diasDeFerias: 10 });
            assert.deepEqual(caio.earningsList, [{ description: 'Terço Constitucional de Férias', value: 333.33, isPercentage: false, reference: '10 dias' }]);
            assert.equal(caio.totalEarnings, 333.33);
            assert.equal(caio.totalDeductions, esperado.inss);
            assert.equal(caio.netSalary, esperado.netSalary);
            assert.equal(caio.netSalary, 3000 + 333.33 - esperado.inss);

            const semFerias = processada.corpo.itens.find((i: { id: string }) => i.id === String(ids.Rita));
            assert.deepEqual(semFerias.earningsList, []);
        });

        it('férias que passam da virada do mês pagam o terço proporcional em cada folha', async () => {
            await limpar();
            noDia('2026-10-03');
            const virada = await pedir(tokens.Caio, { inicio: '2026-10-26', fim: '2026-11-04' });
            await decidir(tokens.Rita, virada.corpo.id, { status: 'Aprovada' });
            noDia('2026-11-10');
            const terco = async (competencia: string) => {
                const { corpo } = await chamar('POST', `/api/folha/competencias/${competencia}/processar`, tokens.Rita);
                return corpo.itens.find((i: { id: string }) => i.id === String(ids.Caio)).earningsList[0]?.value;
            };
            assert.equal(await terco('2026-10'), 200, '6 dias em outubro: 3000 / 30 * 6 / 3');
            assert.equal(await terco('2026-11'), 133.33, '4 dias em novembro: 3000 / 30 * 4 / 3');
        });

        it('só as férias aprovadas entram na folha: licença e pendente não geram rubrica', async () => {
            await limpar();
            noDia('2026-10-03');
            await pedir(tokens.Caio, { inicio: '2026-12-01', fim: '2026-12-10' });
            const licenca = await pedir(tokens.Dora, { tipo: 'Licença Maternidade', inicio: '2026-12-01', fim: '2027-03-30', anexo: anexo() });
            await decidir(tokens.Rita, licenca.corpo.id, { status: 'Aprovada' });
            noDia('2026-12-15');
            const { corpo } = await chamar('POST', '/api/folha/competencias/2026-12/processar', tokens.Rita);
            for (const item of corpo.itens) assert.deepEqual(item.earningsList, [], item.name);
        });

        it('os dias de férias e de licença aprovadas não são falta no espelho de ponto', async () => {
            await limpar();
            noDia('2026-10-03');
            const ferias = await pedir(tokens.Caio, { inicio: '2026-10-05', fim: '2026-10-09' });
            await decidir(tokens.Rita, ferias.corpo.id, { status: 'Aprovada' });
            const recusada = await pedir(tokens.Caio, { tipo: 'Outros', inicio: '2026-10-12', fim: '2026-10-12' });
            await decidir(tokens.Rita, recusada.corpo.id, { status: 'Recusada', resposta: 'Não.' });
            noDia('2026-10-20');

            const { corpo } = await chamar('GET', `/api/ponto/historico/${ids.Caio}?mes=2026-10`, tokens.Caio);
            const statusDe = (dia: string) => corpo.find((d: { date: string }) => d.date === dia).status;
            for (const dia of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']) assert.equal(statusDe(dia), 'justificado', dia);
            assert.equal(statusDe('2026-10-10'), 'fim_de_semana');
            assert.equal(statusDe('2026-10-12'), 'falta', 'a recusada não abona');
            assert.equal(statusDe('2026-10-13'), 'falta');

            const totais = await chamar('GET', `/api/ponto/totais/${ids.Caio}?mes=2026-10`, tokens.Caio);
            // Os dias úteis passados do mês são 1, 2, 5 a 9, 12 a 16 e 19; sem as férias (5 a 9) restam 8 faltas.
            assert.equal(totais.corpo.monthlySummary.absences, 8);
        });

        it('quem tem ausência registrada não é excluído: o cadastro é inativado', async () => {
            const { status, corpo } = await chamar('DELETE', `/api/funcionarios/${ids.Caio}`, tokens.Rita);
            assert.equal(status, 409);
            assert.match(corpo.erro, /Inative-o/);
            const lista = await chamar('GET', `/api/funcionarios?busca=${encodeURIComponent('Pessoa Caio')}`, tokens.Rita);
            assert.equal(lista.corpo[0].tem_movimento, true);
        });
    });
});
