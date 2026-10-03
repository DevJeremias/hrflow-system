import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('resumos de testes do verify', () => {
    it('extrai todos os resumos e identifica ignorados em qualquer um', async () => {
        const { skippedCounts } = await import('../../scripts/test-summary.mjs');
        assert.deepEqual(skippedCounts('# skipped 0\n# skipped 1'), [0, 1]);
        assert.deepEqual(skippedCounts('ℹ skipped 0\nℹ skipped 0'), [0, 0]);
        assert.deepEqual(skippedCounts('sem resumo'), []);
    });

    it('lê as linhas cobertas da linha "all files" do relatório de cobertura', async () => {
        const { lineCoverage } = await import('../../scripts/test-summary.mjs');
        const relatorio = [
            'ℹ file                         | line % | branch % | funcs % | uncovered lines',
            'ℹ app.ts                       | 100.00 |   100.00 |  100.00 | ',
            'ℹ all files                    |  98.30 |    91.26 |   97.68 | ',
        ].join('\n');
        assert.equal(lineCoverage(relatorio), 98.3);
        assert.equal(lineCoverage('# all files | 89.9 | 50 | 50 |'), 89.9);
        assert.equal(lineCoverage('sem relatório'), null);
    });

    it('reprova a cobertura abaixo do piso ou sem relatório e aprova no piso', async () => {
        const { coverageVerdict } = await import('../../scripts/test-summary.mjs');
        const relatorio = (linhas: string) => `ℹ all files | ${linhas} | 80.00 | 80.00 |`;
        assert.equal(coverageVerdict(relatorio('89.99'), 90).ok, false);
        assert.match(coverageVerdict(relatorio('89.99'), 90).message, /89\.99%.*piso de 90%/);
        assert.equal(coverageVerdict(relatorio('90.00'), 90).ok, true);
        assert.equal(coverageVerdict(relatorio('97.5'), 90).ok, true);
        assert.equal(coverageVerdict('sem relatório', 90).ok, false);
    });
});
