import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import postcss from 'postcss';

const raiz = new URL('../src/', import.meta.url).pathname;
const propriedadesDeEstilo = /^(?:color|background(?:-color)?|border(?:-[a-z-]+)?|outline(?:-[a-z-]+)?|box-shadow|border-radius|padding(?:-[a-z-]+)?|margin(?:-[a-z-]+)?|gap(?:-[a-z-]+)?|font(?:-[a-z-]+)?)$/;
const corLiteral = /#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\((?!\s*var\s*\(--)[^)]*\)/i;
const medidaLiteral = /(?:^|[\s,(])[-+]?\d+(?:\.\d+)?\s*(?:(?:px|rem|em|mm|cm|pt|vh|vw|vmin|vmax|ch)\b|%)/i;
const tokensPermitidos = new Set([
  'brand-rgb', 'brand-hover-rgb', 'brand-soft-rgb', 'brand-line-rgb', 'brand-text-rgb', 'brand-text-hover-rgb', 'brand-foreground-rgb',
  'ink-rgb', 'ink-muted-rgb', 'ink-subtle-rgb', 'ink-inverse-rgb',
  'surface-rgb', 'surface-muted-rgb', 'surface-sunken-rgb', 'surface-inverse-rgb',
  'line-rgb', 'line-strong-rgb', 'line-input-rgb', 'focus-rgb', 'overlay-rgb',
  'success-rgb', 'success-soft-rgb', 'success-line-rgb',
  'warning-rgb', 'warning-soft-rgb', 'warning-line-rgb',
  'danger-rgb', 'danger-hover-rgb', 'danger-foreground-rgb', 'danger-soft-rgb', 'danger-line-rgb',
  'info-rgb', 'info-soft-rgb', 'info-line-rgb',
  'document-ink-rgb', 'document-surface-rgb', 'document-muted-rgb', 'document-line-rgb', 'document-negative-rgb',
  'focus-ring-width', 'focus-ring-offset',
]);

async function arquivosCss(diretorio) {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  const grupos = await Promise.all(entradas.map(async (entrada) => {
    const caminho = join(diretorio, entrada.name);
    if (entrada.isDirectory()) return arquivosCss(caminho);
    return extname(entrada.name) === '.css' ? [caminho] : [];
  }));
  return grupos.flat();
}

const infracoes = [];
for (const arquivo of await arquivosCss(raiz)) {
  const texto = await readFile(arquivo, 'utf8');
  const ast = postcss.parse(texto, { from: arquivo });
  ast.walkDecls((declaracao) => {
    const linha = declaracao.source?.start?.line ?? 1;
    const margemA4 = declaracao.parent.type === 'atrule'
      && declaracao.parent.name === 'page'
      && declaracao.prop === 'margin'
      && declaracao.value === '12mm';
    if (margemA4) return;
    if (declaracao.prop.startsWith('--')) {
      if (!tokensPermitidos.has(declaracao.prop.slice(2))) infracoes.push(`${relative(raiz, arquivo)}:${linha} ${declaracao.prop}: registre o token no design system`);
      return;
    }

    for (const [, nome] of declaracao.value.matchAll(/var\(\s*--([\w-]+)/g)) {
      if (!tokensPermitidos.has(nome)) infracoes.push(`${relative(raiz, arquivo)}:${linha} var(--${nome}): token não registrado`);
    }
    if (!propriedadesDeEstilo.test(declaracao.prop)) return;
    if (!corLiteral.test(declaracao.value) && !medidaLiteral.test(declaracao.value)) return;
    infracoes.push(`${relative(raiz, arquivo)}:${linha} ${declaracao.prop}: valor visual literal deve virar token`);
  });
}

if (infracoes.length > 0) {
  console.error('Design system: estilos CSS fora dos tokens:');
  for (const infracao of infracoes) console.error(`  ${infracao}`);
  process.exitCode = 1;
} else {
  console.log('Design system: CSS sem cores ou medidas visuais literais fora dos tokens.');
}
