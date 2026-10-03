import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('resumos de testes do verify', () => {
    it('extrai todos os resumos e identifica ignorados em qualquer um', async () => {
        const { skippedCounts } = await import('../../scripts/test-summary.mjs');
        assert.deepEqual(skippedCounts('# skipped 0\n# skipped 1'), [0, 1]);
        assert.deepEqual(skippedCounts('ℹ skipped 0\nℹ skipped 0'), [0, 0]);
        assert.deepEqual(skippedCounts('sem resumo'), []);
    });
});
