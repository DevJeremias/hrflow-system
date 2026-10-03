// As guardas que impedem a bagunça de voltar: .js novo no código, código fora de modules/ e shared/,
// e uma área importando o interior de outra. Não precisam de banco.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ESLint } from 'eslint';
import { arquivosJavaScriptProibidos, CONFIGURACOES_PERMITIDAS } from '../../scripts/guardar-estrutura.mts';

const RAIZ = path.join(import.meta.dirname, '..');

describe('guarda de arquivos JavaScript', () => {
    it('recusa .js e .jsx no back-end e no front-end', () => {
        const achados = arquivosJavaScriptProibidos([
            'backend/shared/utils/novo.js',
            'backend/tests/novo.test.js',
            'frontend/src/pages/Nova.jsx',
            'frontend/src/utils/novo.js',
            'frontend/src/App.tsx',
            'backend/app.ts',
        ]);
        assert.deepEqual(achados, [
            'backend/shared/utils/novo.js',
            'backend/tests/novo.test.js',
            'frontend/src/pages/Nova.jsx',
            'frontend/src/utils/novo.js',
        ]);
    });

    it('aceita só as configurações de ferramenta listadas e ignora o que está fora de backend/ e frontend/', () => {
        assert.deepEqual(arquivosJavaScriptProibidos([...CONFIGURACOES_PERMITIDAS, 'commitlint.config.js', 'scripts/db.mjs']), []);
        assert.deepEqual(arquivosJavaScriptProibidos(['frontend/outra.config.js']), ['frontend/outra.config.js']);
    });
});

describe('regras de lint do back-end', () => {
    const eslint = new ESLint({ cwd: RAIZ });
    const mensagens = async (codigo: string, arquivo: string) => {
        const [resultado] = await eslint.lintText(codigo, { filePath: path.join(RAIZ, arquivo) });
        return resultado.messages.map((mensagem) => mensagem.message);
    };

    it('uma área só importa outra pelo index.ts', async () => {
        const [recusado] = await mensagens("import { x } from '../auth/auth.service.ts';\n", 'modules/ponto/ponto.service.ts');
        assert.match(recusado, /Importe a área "auth" só por modules\/auth\/index\.ts/);
        const [porCaminhoLongo] = await mensagens("import type { X } from '../../modules/folha/folha.service.ts';\n", 'modules/ponto/ponto.service.ts');
        assert.match(porCaminhoLongo, /área "folha"/);

        assert.deepEqual(await mensagens("import { x } from '../auth/index.ts';\n", 'modules/ponto/ponto.service.ts'), []);
    });

    it('a área pode importar o próprio interior e o shared', async () => {
        const codigo = "import { x } from './ponto.regras.ts';\nimport db from '../../shared/db/pool.ts';\n";
        assert.deepEqual(await mensagens(codigo, 'modules/ponto/ponto.service.ts'), []);
    });

    it('código novo fora de modules/ e shared/ é recusado', async () => {
        for (const arquivo of ['utils/novo.ts', 'controllers/novo.ts', 'novo.ts']) {
            const [mensagem] = await mensagens('export const x = 1;\n', arquivo);
            assert.match(mensagem, /fora de modules\/ e shared\//, arquivo);
        }
        for (const arquivo of ['app.ts', 'server.ts', 'modules/ponto/novo.ts', 'shared/utils/novo.ts', 'tests/novo.test.ts', 'types/novo.d.ts']) {
            assert.deepEqual(await mensagens('export const x = 1;\n', arquivo), [], arquivo);
        }
    });
});
