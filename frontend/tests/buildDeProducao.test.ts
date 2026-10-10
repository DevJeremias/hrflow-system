// O build de produção: o código se separa por grupo de rotas (a landing abre sem o painel) e o PWA
// sai com manifesto e service worker corretos.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import { PONTO_THEME_COLOR } from '../tailwind.config.js';

const raiz = new URL('..', import.meta.url).pathname;
const LIMITE_GZIP_DA_LANDING = 150 * 1024;
// Um chunk por tela, nomeado pelo arquivo da página.
const GRUPOS: Record<string, string[]> = {
  landing: ['Home'],
  autenticação: ['Login'],
  administração: ['Dashboard', 'Employees', 'OrgStructure', 'Payroll', 'TimeTracking'],
  portal: ['EmployeeDashboard', 'Payslips', 'Profile'],
};

let saida: string;
let pasta: string;
let js: string[];

before(async () => {
  saida = mkdtempSync(join(tmpdir(), 'hrflow-chunks-'));
  await build({ root: raiz, logLevel: 'silent', build: { outDir: saida, emptyOutDir: true } });
  pasta = join(saida, 'assets');
  js = readdirSync(pasta).filter((nome) => nome.endsWith('.js'));
});

after(() => rmSync(saida, { recursive: true, force: true }));

const chunkDe = (nome: string) => js.find((arquivo) => arquivo.startsWith(`${nome}-`));

// O arquivo e tudo o que ele importa por `import ... from './x.js'` (os dinâmicos ficam de fora:
// são o que se baixa depois).
const comDependencias = (arquivo: string, vistos = new Set<string>()): Set<string> => {
  if (vistos.has(arquivo)) return vistos;
  vistos.add(arquivo);
  const codigo = readFileSync(join(pasta, arquivo), 'utf8');
  for (const [, dependencia] of codigo.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) comDependencias(dependencia, vistos);
  return vistos;
};

test('o build emite um chunk por tela, em todos os grupos de rotas', () => {
  const chunks = Object.values(GRUPOS).flat();
  for (const [grupo, nomes] of Object.entries(GRUPOS)) {
    for (const nome of nomes) assert.ok(chunkDe(nome), `chunk de ${nome} (${grupo}) ausente do build`);
  }
  assert.ok(chunks.filter((nome) => chunkDe(nome)).length >= 4);
});

test('o chunk inicial da landing tem menos de 150 kB gzip', () => {
  const html = readFileSync(join(saida, 'index.html'), 'utf8');
  const entrada = /src="\/assets\/([^"]+\.js)"/.exec(html)?.[1];
  assert.ok(entrada, 'o index.html não aponta para um script de entrada');

  const home = chunkDe('Home');
  assert.ok(home);
  const arquivos = new Set([...comDependencias(entrada), ...comDependencias(home)]);
  const gzip = [...arquivos].reduce((soma, arquivo) => soma + gzipSync(readFileSync(join(pasta, arquivo))).length, 0);
  assert.ok(gzip < LIMITE_GZIP_DA_LANDING, `a landing baixa ${(gzip / 1024).toFixed(1)} kB gzip no primeiro carregamento`);

  // O código do painel não vai junto.
  for (const nome of ['Employees', 'Payroll', 'OrgStructure', 'EmployeeDashboard']) {
    const chunk = chunkDe(nome);
    assert.ok(chunk && !arquivos.has(chunk), `${nome} não deveria ser baixado pela landing`);
  }
});

const manifesto = () => JSON.parse(readFileSync(join(saida, 'manifest.webmanifest'), 'utf8')) as {
  lang: string; theme_color: string; icons: { src: string; sizes: string; purpose?: string }[];
};

// Largura e altura do PNG, lidas do cabeçalho IHDR.
const dimensoesDoPng = (arquivo: string) => {
  const bytes = readFileSync(arquivo);
  assert.equal(bytes.subarray(1, 4).toString('latin1'), 'PNG', `${arquivo} não é PNG`);
  return { largura: bytes.readUInt32BE(16), altura: bytes.readUInt32BE(20) };
};

test('os ícones do manifesto são quadrados e do tamanho declarado, com um maskable', () => {
  const { icons } = manifesto();
  assert.ok(icons.some((icone) => icone.purpose === 'maskable'), 'falta um ícone maskable');
  assert.ok(icons.some((icone) => icone.sizes === '192x192') && icons.some((icone) => icone.sizes === '512x512'));
  for (const icone of icons) {
    const { largura, altura } = dimensoesDoPng(join(saida, icone.src));
    assert.equal(largura, altura, `${icone.src} não é quadrado (${largura}x${altura})`);
    assert.equal(`${largura}x${altura}`, icone.sizes, `${icone.src} não tem o tamanho declarado`);
  }
});

test('o manifesto fala pt-BR e usa a cor primária do tema, a mesma do meta theme-color', () => {
  const { lang, theme_color: cor } = manifesto();
  const primaria = PONTO_THEME_COLOR;
  assert.equal(lang, 'pt-BR');
  assert.equal(cor, primaria);
  const html = readFileSync(join(saida, 'index.html'), 'utf8');
  assert.match(html, new RegExp(`<meta name="theme-color" content="${primaria}"`));
  assert.match(html, /<meta name="description" content="[^"]{20,}"/);
});

test('o service worker nunca serve o app para a API e só assume com a confirmação da pessoa', () => {
  const sw = readFileSync(join(saida, 'sw.js'), 'utf8');
  assert.ok(sw.includes('denylist:[/^\\/api\\//]'), 'a navegação para /api/ precisa estar na lista de exclusão');
  assert.match(sw, /"SKIP_WAITING"===[\w.]+\.data\.type&&self\.skipWaiting\(\)/, 'skipWaiting só por mensagem do aviso de atualização');
  assert.doesNotMatch(sw, /clientsClaim/);
});
