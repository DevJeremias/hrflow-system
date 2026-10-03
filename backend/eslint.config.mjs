// Fronteiras do back-end (ver backend/README.md, "Regras de estrutura"):
// 1. código novo só em modules/<área> e shared/ (mais app.ts e server.ts, que montam a aplicação);
// 2. uma área não importa o interior de outra: só o index.ts dela.
// O parser entende TypeScript; nenhuma outra regra de estilo é imposta aqui.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import tseslint from 'typescript-eslint';

const RAIZ = import.meta.dirname;

// Pastas de código e de apoio que podem existir na raiz do back-end. migrations/ guarda SQL, não código.
const PASTAS_PERMITIDAS = new Set(['modules', 'shared', 'tests', 'types', 'migrations']);
const ARQUIVOS_PERMITIDOS = new Set(['app.ts', 'server.ts', 'eslint.config.mjs']);

const areas = readdirSync(path.join(RAIZ, 'modules'), { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name);

const estrutura = {
    rules: {
        'codigo-no-lugar': {
            meta: {
                type: 'problem',
                messages: {
                    foraDoLugar: '{{ arquivo }} está fora de modules/ e shared/. Código novo do back-end vai em modules/<área> (regra de uma área) ou shared/ (o que mais de uma área usa).',
                },
                schema: [],
            },
            create: (context) => ({
                Program: (node) => {
                    const relativo = path.relative(RAIZ, context.filename).split(path.sep).join('/');
                    const [topo] = relativo.split('/');
                    if (ARQUIVOS_PERMITIDOS.has(relativo) || PASTAS_PERMITIDAS.has(topo)) return;
                    context.report({ node, messageId: 'foraDoLugar', data: { arquivo: relativo } });
                },
            }),
        },
    },
};

// De modules/<área>, importar ../<outra>/<qualquer coisa> (ou ../../modules/<outra>/...) só vale se
// for o index.ts da outra área. O regex vê o texto do import, então também pega `import type`.
const importaInteriorDeOutraArea = (outra) => ({
    regex: `^(\\.\\./)+(modules/)?${outra}/(?!index\\.ts$)`,
    message: `Importe a área "${outra}" só por modules/${outra}/index.ts: o interior dela pode mudar sem aviso.`,
});

export default [
    { ignores: ['node_modules'] },
    {
        files: ['**/*.{js,mjs,cjs,ts}'],
        languageOptions: { parser: tseslint.parser },
        plugins: { estrutura },
        rules: { 'estrutura/codigo-no-lugar': 'error' },
    },
    ...areas.map((area) => ({
        files: [`modules/${area}/**/*.ts`],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: areas.filter((outra) => outra !== area).map(importaInteriorDeOutraArea),
            }],
        },
    })),
];
