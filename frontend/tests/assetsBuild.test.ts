// Imagens referenciadas por caminho literal (./src/assets/x.png) só existem no servidor de
// desenvolvimento do Vite; no build servido como estático o caminho devolve o index.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { build } from 'vite';

const raiz = new URL('..', import.meta.url).pathname;
const EXTENSOES_DE_IMAGEM = /\.(png|jpe?g|avif|webp|gif|svg)$/;
// Orçamento de peso das imagens do build (auditoria H-22: o login chegou a 8 MB e a landing a 6 MB em PNG bruto).
const LIMITE_POR_IMAGEM = 300 * 1024;
const LIMITE_TOTAL = 1024 * 1024;
const CAMINHO_LITERAL = /(?:src\s*=\s*|url\()\s*["'{`(]*\s*\.?\/src\//g;

const arquivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return ['.tsx', '.jsx', '.css'].includes(extname(nome)) ? [caminho] : [];
  });

test('o código-fonte não referencia imagens por caminho literal /src/ ou ./src/', () => {
  const infratores = arquivos(join(raiz, 'src')).filter((arquivo) => CAMINHO_LITERAL.test(readFileSync(arquivo, 'utf8')) || (CAMINHO_LITERAL.lastIndex = 0, false));
  assert.deepEqual(infratores, []);
});

test('o build de produção empacota as imagens com hash e sem caminhos /src/', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'hrflow-build-'));
  try {
    await build({ root: raiz, logLevel: 'silent', build: { outDir, emptyOutDir: true } });
    const pasta = join(outDir, 'assets');
    const imagens = readdirSync(pasta).filter((nome) => EXTENSOES_DE_IMAGEM.test(nome));
    for (const base of ['logo', 'mosaico_image1', 'mosaico_image2', 'mosaico_image3', 'mosaico_image4', 'mosaico_image5', 'hero_imagem', 'login_imagem2']) {
      assert.ok(imagens.some((nome) => nome.startsWith(`${base}-`)), `imagem ${base} ausente do build`);
    }
    const js = readdirSync(pasta).filter((nome) => nome.endsWith('.js')).map((nome) => readFileSync(join(pasta, nome), 'utf8')).join('\n');
    assert.doesNotMatch(js, /["'`]\.?\/src\/assets\//);
    for (const nome of imagens) assert.ok(existsSync(join(pasta, nome)));
    assert.ok(!imagens.some((nome) => nome.startsWith('hero-')), 'hero.png não é usado e não deve voltar');

    // Tudo que o build publica como imagem: as importadas (assets/, com hash) e as de public/ (raiz).
    const publicadas = [pasta, outDir].flatMap((dir) =>
      readdirSync(dir).filter((nome) => EXTENSOES_DE_IMAGEM.test(nome)).map((nome) => ({ nome, bytes: statSync(join(dir, nome)).size })));
    const pesadas = publicadas.filter(({ bytes }) => bytes > LIMITE_POR_IMAGEM).map(({ nome, bytes }) => `${nome} (${Math.round(bytes / 1024)} KB)`);
    assert.deepEqual(pesadas, [], `imagens acima de ${LIMITE_POR_IMAGEM / 1024} KB`);
    const total = publicadas.reduce((soma, { bytes }) => soma + bytes, 0);
    assert.ok(total < LIMITE_TOTAL, `as imagens do build somam ${Math.round(total / 1024)} KB, acima de ${LIMITE_TOTAL / 1024} KB`);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
