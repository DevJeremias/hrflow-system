// B-09: a listagem de ponto da empresa é por mês, paginada e indexada. Requer MySQL real: o banco é
// criado e migrado por tests/support/bancoDeTeste.js; sem HRFLOW_TEST_DB_HOST os testes são
// marcados como ignorados, nunca como aprovados.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const banco = require('./support/bancoDeTeste');
const { criarUsuario, cabecalhosDaSessao } = require('./support/sessao');

const db = require('../shared/db/pool');
const authMiddleware = require('../shared/middlewares/authMiddleware');
const { pontoRoutes } = require('../modules/ponto/index.ts');
const { consultaDosPontosDaEmpresa } = require('../modules/ponto/ponto.repository.ts');
const fuso = require('../modules/ponto/ponto.fuso.ts');

const semBanco = banco.skip;
const OUTUBRO = '2026-10';
const SETEMBRO = '2026-09';
const MARCACOES_POR_MES = 120;

const ctx = {};
let servidor;
let baseUrl;

// Instante em segundos Unix de um dia e hora do relógio de Belém.
const instanteEmBelem = (dia, hora) => fuso.limitesDoDia(dia).inicio + hora * 3600;

// FROM_UNIXTIME grava o instante sem depender do fuso da sessão do MySQL nem do processo Node.
const inserirPontos = (linhas) => db.query(
    `INSERT INTO registro_pontos (funcionario_id, empresa_id, tipo_registro, data_hora_oficial)
     VALUES ${linhas.map(() => '(?, ?, ?, FROM_UNIXTIME(?))').join(', ')}`,
    linhas.flat()
);

const novoFuncionario = async (empresaId, nome, indice) => {
    const [r] = await db.query(
        `INSERT INTO funcionarios (nome, cpf, email, data_admissao, empresa_id) VALUES (?, ?, ?, '2024-01-02', ?)`,
        [nome, `000.000.000-0${indice}`, `funcionario${indice}@exemplo.invalid`, empresaId]
    );
    return r.insertId;
};

// Uma marcação por dia útil a cada 30 minutos a partir das 06:00 de Belém, em dias diferentes do mês.
const marcacoesDoMes = (funcionarioId, empresaId, mes, quantidade) => Array.from({ length: quantidade }, (_, i) => [
    funcionarioId, empresaId, 'Entrada', instanteEmBelem(`${mes}-${String(1 + (i % 28)).padStart(2, '0')}`, 6 + Math.floor(i / 28)),
]);

const get = async (caminho, token = ctx.tokenRH) => {
    const resposta = await fetch(`${baseUrl}${caminho}`, { headers: { ...cabecalhosDaSessao(token) } });
    return { status: resposta.status, total: resposta.headers.get('X-Total-Count'), corpo: await resposta.json() };
};

test.before(async () => {
    if (semBanco) return;
    await banco.preparar();

    const sufixo = `${process.pid}-${Date.now()}`;
    const [a] = await db.query('INSERT INTO empresas (nome) VALUES (?)', [`Empresa Ficticia A ${sufixo}`]);
    const [b] = await db.query('INSERT INTO empresas (nome) VALUES (?)', [`Empresa Ficticia B ${sufixo}`]);
    ctx.empresaA = a.insertId;
    ctx.empresaB = b.insertId;
    ctx.ana = await novoFuncionario(ctx.empresaA, 'Ana Ficticia', 1);
    ctx.beto = await novoFuncionario(ctx.empresaA, 'Beto 100% Ficticio', 2);
    ctx.eva = await novoFuncionario(ctx.empresaB, 'Eva Externa Ficticia', 3);

    // Dois meses de dados da Ana, mais marcações do Beto em outubro e da Eva (outra empresa).
    await inserirPontos([
        ...marcacoesDoMes(ctx.ana, ctx.empresaA, OUTUBRO, MARCACOES_POR_MES),
        ...marcacoesDoMes(ctx.ana, ctx.empresaA, SETEMBRO, MARCACOES_POR_MES),
        ...marcacoesDoMes(ctx.beto, ctx.empresaA, OUTUBRO, 5),
        ...marcacoesDoMes(ctx.eva, ctx.empresaB, OUTUBRO, 7),
        // O dia civil é o de Belém (UTC-3): 23:30 de 30/09 em Belém já é 02:30 UTC de 01/10.
        [ctx.ana, ctx.empresaA, 'Saída', instanteEmBelem('2026-09-30', 23.5)],
        [ctx.ana, ctx.empresaA, 'Entrada', instanteEmBelem('2026-10-01', 0)],
        // O horário que a tela mostra: 14:00 de 02/10/2026 em Belém.
        [ctx.beto, ctx.empresaA, 'Saída', instanteEmBelem('2026-10-02', 14)],
    ]);
    // Quadro de colaboradores de tamanho real: numa tabela de 3 linhas o otimizador prefere ler
    // funcionarios inteira num hash join, o que obriga a ordenar o mês todo e não acontece em produção.
    await db.query(
        `INSERT INTO funcionarios (nome, cpf, email, data_admissao, empresa_id) VALUES ${Array(300).fill('(?, ?, ?, ?, ?)').join(', ')}`,
        Array.from({ length: 300 }, (_, i) => [`Quadro Ficticio ${i}`, `900.000.${i}-00`, `quadro${i}@exemplo.invalid`, '2024-01-02', ctx.empresaA]).flat()
    );
    // Anos de histórico fora dos dois meses: com a tabela quase toda fora do mês, o otimizador só
    // escolhe o índice por empresa e data se ele de fato compensa, como em produção.
    for (const mes of ['2024-03', '2024-07', '2025-01', '2025-05', '2025-11', '2026-02']) {
        await inserirPontos(marcacoesDoMes(ctx.ana, ctx.empresaA, mes, 28 * 5));
        await inserirPontos(marcacoesDoMes(ctx.eva, ctx.empresaB, mes, 28 * 5));
    }
    await db.query('ANALYZE TABLE registro_pontos');

    ctx.tokenRH = (await criarUsuario(db, { empresaId: ctx.empresaA, perfil: 'RH' })).token;
    ctx.tokenColaborador = (await criarUsuario(db, { empresaId: ctx.empresaA, perfil: 'Colaborador', funcionarioId: ctx.ana })).token;

    const app = express();
    app.use(express.json());
    app.use('/api/ponto', authMiddleware, pontoRoutes);
    await new Promise((resolve) => { servidor = app.listen(0, '127.0.0.1', resolve); });
    baseUrl = `http://127.0.0.1:${servidor.address().port}/api/ponto`;
});

test.after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve));
    await db.end();
    if (!semBanco) await banco.encerrar();
});

test('sem mes a listagem recusa a consulta com 400', { skip: semBanco }, async () => {
    const { status, corpo } = await get('/');
    assert.equal(status, 400);
    assert.match(corpo.erro, /AAAA-MM/);
});

test('mes fora do formato AAAA-MM responde 400', { skip: semBanco }, async () => {
    for (const mes of ['2026-13', '2026-1', '2026-10-02', 'outubro']) {
        assert.equal((await get(`/?mes=${mes}`)).status, 400, mes);
    }
});

test('limite e página inválidos respondem 400', { skip: semBanco }, async () => {
    for (const consulta of ['limite=0', 'limite=1001', 'pagina=0', 'limite=abc']) {
        assert.equal((await get(`/?mes=${OUTUBRO}&${consulta}`)).status, 400, consulta);
    }
});

test('mes e limite=50 devolvem no máximo 50 linhas do mês e o total do mês no X-Total-Count', { skip: semBanco }, async () => {
    const { status, total, corpo } = await get(`/?mes=${OUTUBRO}&limite=50`);
    assert.equal(status, 200);
    assert.equal(corpo.length, 50);
    // Outubro da empresa A: 120 + 5 da Ana e do Beto, mais a meia-noite de 01/10 e a de 02/10 às 14:00.
    assert.equal(total, String(MARCACOES_POR_MES + 5 + 2));
    assert.ok(corpo.every((p) => p.date.startsWith(OUTUBRO)), 'só marcações de outubro, no relógio de Belém');
    assert.ok(corpo.every((p) => p.empresa_id === ctx.empresaA));
});

test('as páginas percorrem o mês sem repetir nem perder marcações, da mais recente à mais antiga', { skip: semBanco }, async () => {
    const ids = [];
    let totalDoMes;
    for (let pagina = 1; pagina <= 3; pagina += 1) {
        const { total, corpo } = await get(`/?mes=${OUTUBRO}&limite=50&pagina=${pagina}`);
        totalDoMes = Number(total);
        ids.push(...corpo.map((p) => p.id));
        const instantes = corpo.map((p) => Date.parse(p.data_hora_oficial));
        assert.deepEqual(instantes, [...instantes].sort((x, y) => y - x), `página ${pagina} em ordem decrescente`);
    }
    assert.equal(ids.length, totalDoMes);
    assert.equal(new Set(ids).size, totalDoMes);
    assert.equal((await get(`/?mes=${OUTUBRO}&limite=50&pagina=4`)).corpo.length, 0);
});

test('sem limite a primeira página vem com o limite padrão', { skip: semBanco }, async () => {
    const { corpo, total } = await get(`/?mes=${OUTUBRO}`);
    assert.equal(corpo.length, Number(total));
});

test('a virada do mês segue o relógio de Belém, não o UTC', { skip: semBanco }, async () => {
    const setembro = await get(`/?mes=${SETEMBRO}&limite=1000`);
    const outubro = await get(`/?mes=${OUTUBRO}&limite=1000`);
    assert.equal(setembro.total, String(MARCACOES_POR_MES + 1));
    assert.ok(setembro.corpo.some((p) => p.date === '2026-09-30' && p.time === '23:30:00'));
    assert.ok(outubro.corpo.some((p) => p.date === '2026-10-01' && p.time === '00:00:00'));
    assert.ok(!outubro.corpo.some((p) => p.date === '2026-09-30'));
});

test('devolve a data ISO e o horário de Belém de cada marcação', { skip: semBanco }, async () => {
    const { corpo } = await get(`/?mes=${OUTUBRO}&funcionarioId=${ctx.beto}&limite=1000`);
    const ponto = corpo.find((p) => p.tipo_registro === 'Saída');
    assert.equal(ponto.date, '2026-10-02');
    assert.equal(ponto.time, '14:00:00');
    assert.equal(ponto.nome_funcionario, 'Beto 100% Ficticio');
});

test('funcionarioId restringe a listagem e o total ao colaborador', { skip: semBanco }, async () => {
    const { total, corpo } = await get(`/?mes=${OUTUBRO}&funcionarioId=${ctx.beto}`);
    assert.equal(total, '6');
    assert.ok(corpo.every((p) => p.funcionario_id === ctx.beto));
});

test('busca filtra pelo nome do colaborador e trata % e _ como texto', { skip: semBanco }, async () => {
    const ana = await get(`/?mes=${OUTUBRO}&busca=ana`);
    assert.equal(ana.total, String(MARCACOES_POR_MES + 1));
    assert.ok(ana.corpo.every((p) => p.funcionario_id === ctx.ana));

    const porcento = await get(`/?mes=${OUTUBRO}&busca=${encodeURIComponent('100%')}`);
    assert.equal(porcento.total, '6');
    const curinga = await get(`/?mes=${OUTUBRO}&busca=${encodeURIComponent('%')}`);
    assert.equal(curinga.total, '6', 'só o nome que contém o caractere %');
    const sublinhado = await get(`/?mes=${OUTUBRO}&busca=${encodeURIComponent('_')}`);
    assert.equal(sublinhado.total, '0');
});

test('nunca devolve marcações de outra empresa', { skip: semBanco }, async () => {
    const { total, corpo } = await get(`/?mes=${OUTUBRO}&funcionarioId=${ctx.eva}`);
    assert.equal(total, '0');
    assert.deepEqual(corpo, []);
});

test('Colaborador não acessa a listagem da empresa', { skip: semBanco }, async () => {
    assert.equal((await get(`/?mes=${OUTUBRO}`, ctx.tokenColaborador)).status, 403);
});

const tabelasDoPlano = (no, achadas = []) => {
    if (Array.isArray(no)) no.forEach((filho) => tabelasDoPlano(filho, achadas));
    else if (no && typeof no === 'object') {
        if (no.table_name) achadas.push(no);
        Object.values(no).forEach((filho) => tabelasDoPlano(filho, achadas));
    }
    return achadas;
};

test('o EXPLAIN da página usa o índice (empresa_id, data_hora_oficial) e dispensa o filesort', { skip: semBanco }, async () => {
    const { inicio, fim } = fuso.limitesDoMes(OUTUBRO);
    const { sql, valores } = consultaDosPontosDaEmpresa({
        empresaId: ctx.empresaA, inicio, fim, funcionarioId: null, busca: null, limite: 50, deslocamento: 0,
    });
    const [[plano]] = await db.query(`EXPLAIN FORMAT=JSON ${sql}`, valores);
    const ponto = tabelasDoPlano(JSON.parse(plano.EXPLAIN)).find((t) => t.table_name === 'p');
    assert.equal(ponto.key, 'idx_registro_pontos_empresa_data');
    assert.doesNotMatch(plano.EXPLAIN, /"using_filesort": true/, 'a ordem vem do índice');
});

// Com colaborador ou busca por nome o otimizador pode preferir o índice por colaborador, que também serve.
test('filtrada por colaborador ou por nome a consulta lê por índice, nunca a tabela inteira', { skip: semBanco }, async () => {
    const { inicio, fim } = fuso.limitesDoMes(OUTUBRO);
    for (const filtro of [{ funcionarioId: ctx.beto }, { busca: 'ana' }]) {
        const { sql, valores } = consultaDosPontosDaEmpresa({
            empresaId: ctx.empresaA, inicio, fim, funcionarioId: null, busca: null, limite: 50, deslocamento: 0, ...filtro,
        });
        const [[plano]] = await db.query(`EXPLAIN FORMAT=JSON ${sql}`, valores);
        const ponto = tabelasDoPlano(JSON.parse(plano.EXPLAIN)).find((t) => t.table_name === 'p');
        assert.ok(['idx_registro_pontos_empresa_data', 'idx_registro_pontos_funcionario_data'].includes(ponto.key), `${JSON.stringify(filtro)}: ${ponto.key}`);
    }
});
