// Fuso e regras do ponto sem banco: rodam sempre. Belém é UTC-3 o ano todo (sem horário de verão
// desde 2019); as datas abaixo cruzam a meia-noite local, que é o caso em que toISOString erra.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { criarFuso, mesValido } from '../shared/utils/fuso.ts';
import * as regras from '../modules/ponto/ponto.regras.ts';

const s = (iso: string) => Date.parse(iso) / 1000;
const fuso = criarFuso('America/Belem');

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
        for (const ok of ['2026-03', '1999-12']) assert.equal(mesValido(ok), true, ok);
        for (const ruim of [undefined, null, '', '2026-3', '2026-13', '2026-00', '2026-03-01', "2026-03' OR 1=1", 202603, ['2026-03']]) {
            assert.equal(mesValido(ruim), false, String(ruim));
        }
    });

    it('cada empresa tem o seu fuso: Manaus está uma hora atrás de Belém', () => {
        const manaus = criarFuso('America/Manaus');
        // 02:30 UTC é 23:30 do dia anterior em Belém (UTC-3) e 22:30 em Manaus (UTC-4).
        assert.equal(fuso.diaLocal(s('2026-03-11T02:30:00Z')), '2026-03-10');
        assert.equal(manaus.diaLocal(s('2026-03-11T02:30:00Z')), '2026-03-10');
        assert.equal(manaus.horaLocal(s('2026-03-11T02:30:00Z')), '22:30:00');
        // 03:30 UTC já é o dia 11 em Belém, mas ainda o dia 10 em Manaus.
        assert.equal(fuso.diaLocal(s('2026-03-11T03:30:00Z')), '2026-03-11');
        assert.equal(manaus.diaLocal(s('2026-03-11T03:30:00Z')), '2026-03-10');
        assert.deepEqual(manaus.limitesDoDia('2026-03-10'), { inicio: s('2026-03-10T04:00:00Z'), fim: s('2026-03-11T04:00:00Z') });
        assert.deepEqual(manaus.limitesDoMes('2026-03'), { inicio: s('2026-03-01T04:00:00Z'), fim: s('2026-04-01T04:00:00Z') });
        assert.equal(manaus.mesLocal(s('2026-04-01T03:59:59Z')), '2026-03');
    });

    it('a zona é criada uma vez e uma zona desconhecida é recusada ao criar', () => {
        assert.equal(criarFuso('America/Manaus'), criarFuso('America/Manaus'));
        assert.equal(criarFuso().zona, 'America/Belem');
        assert.throws(() => criarFuso('Marte/Olympus'), RangeError);
    });

    it('não depende do fuso do processo Node', () => {
        const codigo = `
            import { criarFuso } from './shared/utils/fuso.ts';
            const f = criarFuso('America/Belem');
            const t = Date.parse('2026-03-11T01:30:05Z') / 1000;
            console.log([f.diaLocal(t), f.horaLocal(t), f.limitesDoDia('2026-03-10').inicio].join('|'));`;
        const esperado = `2026-03-10|22:30:05|${s('2026-03-10T03:00:00Z')}`;
        for (const TZ of ['UTC', 'Pacific/Auckland', 'America/Los_Angeles', 'Asia/Kolkata']) {
            const saida = execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { cwd: path.join(import.meta.dirname, '..'), env: { ...process.env, TZ } });
            assert.equal(saida.toString().trim(), esperado, TZ);
        }
    });
});

// As validações devolvem { dados } ou { erro }; estes dois lêem o lado que o teste espera.
const erroDe = (validacao: regras.Validacao<unknown>) => ('erro' in validacao ? validacao.erro : undefined);
const dadosDe = <T>(validacao: regras.Validacao<T>) => ('dados' in validacao ? validacao.dados : undefined);

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
            assert.match(String(erroDe(regras.validarTipo(tipo))), /Tipo de registro inválido/, String(tipo));
        }
        assert.equal(dadosDe(regras.validarTipo('Saída')), 'Saída');
    });

    it('aceita coordenadas válidas, inclusive os extremos e o zero', () => {
        for (const [latitude, longitude] of [[-1.45502, -48.5024], [90, 180], [-90, -180], [0, 0]]) {
            assert.deepEqual(dadosDe(regras.validarCoordenadas({ latitude, longitude })), { latitude, longitude });
        }
    });

    it('sem coordenadas devolve nulos; um lado só é recusado', () => {
        assert.deepEqual(dadosDe(regras.validarCoordenadas({})), { latitude: null, longitude: null });
        assert.deepEqual(dadosDe(regras.validarCoordenadas({ latitude: null, longitude: null })), { latitude: null, longitude: null });
        assert.match(String(erroDe(regras.validarCoordenadas({ latitude: 1 }))), /juntas/);
        assert.match(String(erroDe(regras.validarCoordenadas({ longitude: 1 }))), /juntas/);
    });

    it('recusa coordenadas fora do intervalo, não numéricas ou não finitas', () => {
        assert.match(String(erroDe(regras.validarCoordenadas({ latitude: 90.0001, longitude: 0 }))), /Latitude fora/);
        assert.match(String(erroDe(regras.validarCoordenadas({ latitude: -91, longitude: 0 }))), /Latitude fora/);
        assert.match(String(erroDe(regras.validarCoordenadas({ latitude: 0, longitude: 180.5 }))), /Longitude fora/);
        assert.match(String(erroDe(regras.validarCoordenadas({ latitude: 0, longitude: -181 }))), /Longitude fora/);
        for (const ruim of ['-1.45', '', ' ', '1e3', true, [], {}, NaN, Infinity]) {
            assert.match(String(erroDe(regras.validarCoordenadas({ latitude: ruim, longitude: 0 }))), /devem ser números/, String(ruim));
        }
    });

    it('limita a observação à coluna e recusa o que não é texto', () => {
        assert.equal(dadosDe(regras.validarObservacao(undefined)), '');
        assert.equal(dadosDe(regras.validarObservacao('a'.repeat(255)))?.length, 255);
        assert.match(String(erroDe(regras.validarObservacao('a'.repeat(256)))), /no máximo 255/);
        assert.match(String(erroDe(regras.validarObservacao(5))), /texto/);
    });
});
