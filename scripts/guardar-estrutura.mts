// Guarda de estrutura: o back-end e o front-end são TypeScript. Falha se houver arquivo .js ou .jsx
// em backend/ ou frontend/, exceto os arquivos de configuração de ferramenta listados abaixo, que
// a ferramenta só lê em JavaScript. Olha os arquivos que o git conhece (rastreados ou novos e não
// ignorados), então node_modules/ e dist/ ficam de fora.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(import.meta.dirname, '..');
const PASTAS_VIGIADAS = ['backend/', 'frontend/'];
const JAVASCRIPT = /\.jsx?$/;

// Configuração de ferramenta na raiz do workspace que não aceita TypeScript. Para entrar aqui o
// arquivo precisa ser exigido pela ferramenta, não só mais cômodo de escrever em JavaScript.
export const CONFIGURACOES_PERMITIDAS = [
    'frontend/eslint.config.js',
    'frontend/postcss.config.js',
    'frontend/tailwind.config.js',
    'frontend/vite.config.js',
];

export const arquivosJavaScriptProibidos = (arquivos: string[]): string[] => arquivos.filter((arquivo) =>
    PASTAS_VIGIADAS.some((pasta) => arquivo.startsWith(pasta))
    && JAVASCRIPT.test(arquivo)
    && !CONFIGURACOES_PERMITIDAS.includes(arquivo));

const arquivosDoGit = (): string[] => execFileSync(
    'git', ['ls-files', '--cached', '--others', '--exclude-standard'],
    { cwd: RAIZ, encoding: 'utf8' },
).split('\n').filter((arquivo) => arquivo !== '' && fs.existsSync(path.join(RAIZ, arquivo)));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const proibidos = arquivosJavaScriptProibidos(arquivosDoGit());
    if (proibidos.length > 0) {
        console.error('Arquivos .js/.jsx não são permitidos em backend/ nem em frontend/. Escreva em TypeScript (.ts/.tsx):');
        for (const arquivo of proibidos) console.error(`  ${arquivo}`);
        console.error(`Configuração de ferramenta que exige .js entra em CONFIGURACOES_PERMITIDAS (${path.relative(RAIZ, fileURLToPath(import.meta.url))}).`);
        process.exit(1);
    }
    console.log('Estrutura ok: nenhum .js/.jsx fora das configurações de ferramenta listadas.');
}
