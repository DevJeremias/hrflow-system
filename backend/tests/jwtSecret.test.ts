import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const modulo = path.join(import.meta.dirname, '../config/jwtSecret.js');

const carregar = (secret: string | undefined) => {
    const env = { ...process.env };
    if (secret === undefined) delete env.JWT_SECRET;
    else env.JWT_SECRET = secret;
    return spawnSync(process.execPath, ['-e', `require(${JSON.stringify(modulo)})`], {
        encoding: 'utf8',
        env,
    });
};

describe('segredo JWT', () => {
    it('recusa segredo ausente', () => {
        const resultado = carregar(undefined);
        assert.notEqual(resultado.status, 0);
        assert.match(resultado.stderr, /JWT_SECRET é obrigatória/);
    });

    it('recusa segredo composto só por espaços', () => {
        const resultado = carregar(' '.repeat(32));
        assert.notEqual(resultado.status, 0);
        assert.match(resultado.stderr, /JWT_SECRET é obrigatória/);
    });

    it('recusa menos de 32 bytes', () => {
        const resultado = carregar('a'.repeat(31));
        assert.notEqual(resultado.status, 0);
        assert.match(resultado.stderr, /pelo menos 32 bytes/);
    });

    it('aceita exatamente 32 bytes', () => {
        const resultado = carregar('a'.repeat(32));
        assert.equal(resultado.status, 0, resultado.stderr);
    });

    it('mede o comprimento em bytes UTF-8', () => {
        const resultado = carregar('á'.repeat(16));
        assert.equal(resultado.status, 0, resultado.stderr);
    });
});
