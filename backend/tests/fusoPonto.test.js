// Fuso e regras do ponto sem banco: rodam sempre. Belém é UTC-3 o ano todo (sem horário de verão
// desde 2019); as datas abaixo cruzam a meia-noite local, que é o caso em que toISOString erra.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fuso = require('../modules/ponto/ponto.fuso');
const regras = require('../modules/ponto/ponto.regras');

const s = (iso) => Date.parse(iso) / 1000;

describe('fusoPonto', () => {
    it('o dia muda às 03:00 UTC, não à meia-noite UTC', () => {
        assert.equal(fuso.diaLocal(s('2026-03-11T02:59:59Z')), '2026-03-10');
        assert.equal(fuso.diaLocal(s('2026-03-11T03:00:00Z')), '2026-03-11');
        assert.equal(fuso.diaLocal(s('2026-03-10T00:30:00Z')), '2026-03-09');
    });

    it('a hora vem em 24 horas, com meia-noite como 00:00:00', () => {
        assert.equal(fuso.horaLocal(s('2026-03-11T01:30:05Z')), '22:30:05');
        assert.equal(fuso.horaLocal(s('2026-03-11T03:00:00Z')), '00:00:00');
        assert.equal(fuso.horaLocal(s('2026-03-11T15:07:00Z')), '12:07:00');
    });

    it('os limites do dia vão de 00:00 a 00:00 de Belém', () => {
        assert.deepEqual(fuso.limitesDoDia('2026-03-10'), { inicio: s('2026-03-10T03:00:00Z'), fim: s('2026-03-11T03:00:00Z') });
        assert.deepEqual(fuso.limitesDoDia('2026-12-31'), { inicio: s('2026-12-31T03:00:00Z'), fim: s('2027-01-01T03:00:00Z') });
        assert.deepEqual(fuso.limitesDoDia('2028-02-28'), { inicio: s('2028-02-28T03:00:00Z'), fim: s('2028-02-29T03:00:00Z') });
    });

    it('os limites do mês cobrem o mês inteiro de Belém, inclusive a virada do ano', () => {
        assert.deepEqual(fuso.limitesDoMes('2026-03'), { inicio: s('2026-03-01T03:00:00Z'), fim: s('2026-04-01T03:00:00Z') });
        assert.deepEqual(fuso.limitesDoMes('2026-12'), { inicio: s('2026-12-01T03:00:00Z'), fim: s('2027-01-01T03:00:00Z') });
    });

    it('uma marcação às 23:59:59 de Belém fica no mês, e a de 00:00:00 do dia seguinte no mês seguinte', () => {
        const { inicio, fim } = fuso.limitesDoMes('2026-03');
        const ultima = s('2026-04-01T02:59:59Z');
        assert.ok(ultima >= inicio && ultima < fim);
        assert.equal(fuso.mesLocal(ultima), '2026-03');
        assert.equal(fuso.mesLocal(fim), '2026-04');
    });

    it('valida o formato do mês', () => {
        for (const ok of ['2026-03', '1999-12']) assert.equal(fuso.mesValido(ok), true, ok);
        for (const ruim of [undefined, null, '', '2026-3', '2026-13', '2026-00', '2026-03-01', "2026-03' OR 1=1", 202603, ['2026-03']]) {
            assert.equal(fuso.mesValido(ruim), false, String(ruim));
        }
    });

    it('não depende do fuso do processo Node', () => {
        const codigo = `
            const f = require('./modules/ponto/ponto.fuso');
            const t = Date.parse('2026-03-11T01:30:05Z') / 1000;
            console.log([f.diaLocal(t), f.horaLocal(t), f.limitesDoDia('2026-03-10').inicio].join('|'));`;
        const esperado = `2026-03-10|22:30:05|${s('2026-03-10T03:00:00Z')}`;
        for (const TZ of ['UTC', 'Pacific/Auckland', 'America/Los_Angeles', 'Asia/Kolkata']) {
            const saida = execFileSync(process.execPath, ['-e', codigo], { cwd: require('node:path').join(__dirname, '..'), env: { ...process.env, TZ } });
            assert.equal(saida.toString().trim(), esperado, TZ);
        }
    });
});

describe('pontoRegras', () => {
    it('a sequência permitida depois de cada marcação', () => {
        assert.deepEqual(regras.proximosPermitidos(null), ['Entrada']);
        assert.deepEqual(regras.proximosPermitidos('Entrada'), ['Pausa Almoço', 'Saída']);
        assert.deepEqual(regras.proximosPermitidos('Pausa Almoço'), ['Retorno Almoço']);
        assert.deepEqual(regras.proximosPermitidos('Retorno Almoço'), ['Saída']);
        assert.deepEqual(regras.proximosPermitidos('Saída'), []);
    });

    it('recusa tipo ausente, desconhecido ou que não é texto', () => {
        for (const tipo of [undefined, null, '', 'Extra', 'entrada', 1, ['Entrada'], { toString: () => 'Entrada' }]) {
            assert.match(regras.validarTipo(tipo).erro, /Tipo de registro inválido/, String(tipo));
        }
        assert.equal(regras.validarTipo('Saída').dados, 'Saída');
    });

    it('aceita coordenadas válidas, inclusive os extremos e o zero', () => {
        for (const [latitude, longitude] of [[-1.45502, -48.5024], [90, 180], [-90, -180], [0, 0]]) {
            assert.deepEqual(regras.validarCoordenadas({ latitude, longitude }).dados, { latitude, longitude });
        }
    });

    it('sem coordenadas devolve nulos; um lado só é recusado', () => {
        assert.deepEqual(regras.validarCoordenadas({}).dados, { latitude: null, longitude: null });
        assert.deepEqual(regras.validarCoordenadas({ latitude: null, longitude: null }).dados, { latitude: null, longitude: null });
        assert.match(regras.validarCoordenadas({ latitude: 1 }).erro, /juntas/);
        assert.match(regras.validarCoordenadas({ longitude: 1 }).erro, /juntas/);
    });

    it('recusa coordenadas fora do intervalo, não numéricas ou não finitas', () => {
        assert.match(regras.validarCoordenadas({ latitude: 90.0001, longitude: 0 }).erro, /Latitude fora/);
        assert.match(regras.validarCoordenadas({ latitude: -91, longitude: 0 }).erro, /Latitude fora/);
        assert.match(regras.validarCoordenadas({ latitude: 0, longitude: 180.5 }).erro, /Longitude fora/);
        assert.match(regras.validarCoordenadas({ latitude: 0, longitude: -181 }).erro, /Longitude fora/);
        for (const ruim of ['-1.45', '', ' ', '1e3', true, [], {}, NaN, Infinity]) {
            assert.match(regras.validarCoordenadas({ latitude: ruim, longitude: 0 }).erro, /devem ser números/, String(ruim));
        }
    });

    it('limita a observação à coluna e recusa o que não é texto', () => {
        assert.equal(regras.validarObservacao(undefined).dados, '');
        assert.equal(regras.validarObservacao('a'.repeat(255)).dados.length, 255);
        assert.match(regras.validarObservacao('a'.repeat(256)).erro, /no máximo 255/);
        assert.match(regras.validarObservacao(5).erro, /texto/);
    });
});
