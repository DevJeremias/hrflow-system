// scripts/db.mjs reset apaga o banco inteiro: recusa sem --banco=<DB_NAME> e com DB_HOST fora da máquina.
// As recusas acontecem antes de qualquer conexão, então o teste não precisa de MySQL.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const SCRIPT = path.join(import.meta.dirname, '..', '..', 'scripts', 'db.mjs');

const resetar = (env: Record<string, string>, ...flags: string[]) => spawnSync(process.execPath, [SCRIPT, 'reset', ...flags], {
    env: { PATH: process.env.PATH, DB_USER: 'root', DB_PASS: 'x', DB_NAME: 'hrflow_descartavel', DB_HOST: '127.0.0.1', ...env },
    encoding: 'utf8',
});

describe('db:reset', () => {
    it('recusa sem --banco', () => {
        const resultado = resetar({});
        assert.equal(resultado.status, 1);
        assert.match(resultado.stderr, /--banco=hrflow_descartavel/);
    });

    it('recusa --banco com outro nome e a antiga --confirmar', () => {
        assert.equal(resetar({}, '--banco=outro').status, 1);
        assert.equal(resetar({}, '--confirmar').status, 1);
    });

    it('recusa DB_HOST que não é local, mesmo com o nome certo', () => {
        const resultado = resetar({ DB_HOST: 'db.interno.exemplo.invalid' }, '--banco=hrflow_descartavel');
        assert.equal(resultado.status, 1);
        assert.match(resultado.stderr, /DB_HOST=db\.interno\.exemplo\.invalid/);
    });

    it('recusa com NODE_ENV=production', () => {
        const resultado = resetar({ NODE_ENV: 'production' }, '--banco=hrflow_descartavel');
        assert.equal(resultado.status, 1);
        assert.match(resultado.stderr, /production/);
    });
});
