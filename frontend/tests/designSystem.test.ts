// Contrato do design system: tokens com contraste AA, utilitários gerados e regras de código que impedem a
// volta dos problemas que a auditoria encontrou (alert nativo, texto minúsculo, label solto, <main> aninhado).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import config, { PONTO_THEME_COLOR } from '../tailwind.config.js';

const raiz = new URL('..', import.meta.url).pathname;
const src = join(raiz, 'src');

const luminancia = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
};

const cssTokens = readFileSync(join(src, 'index.css'), 'utf8');
const blocoTema = (seletor: RegExp) => cssTokens.match(seletor)?.[1] ?? '';
const rootTokens = blocoTema(/:root\s*\{([^}]+)\}/);
const canaisDaVariavel = (bloco: string, nome: string) => [...bloco.matchAll(new RegExp(`--${nome}-rgb:\\s*([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\s*;`, 'g'))].at(-1);
const corDaVariavel = (bloco: string, nome: string) => {
  const canais = canaisDaVariavel(bloco, nome);
  assert.ok(canais, `token --${nome}-rgb está definido`);
  return `#${canais.slice(1).map((canal) => Math.round(Number(canal)).toString(16).padStart(2, '0')).join('')}`;
};
const temas = {
  escuro: rootTokens,
  claro: `${rootTokens}\n${blocoTema(/\[data-theme='light'\]\s*\{([^}]+)\}/)}`,
};

test('as cores de marca separam preenchimento âmbar de texto com contraste', () => {
  const cores = config.theme.extend.colors as Record<string, Record<string, string>>;
  assert.match(cores.brand.DEFAULT, /--brand-text-rgb/);
  assert.match(cores.brand.fill, /--brand-rgb/);
  assert.equal(corDaVariavel(temas.escuro, 'brand').toUpperCase(), PONTO_THEME_COLOR);
  for (const [nome, tema] of Object.entries(temas)) {
    const texto = corDaVariavel(tema, 'brand-text');
    const preenchimento = corDaVariavel(tema, 'brand');
    const superficie = corDaVariavel(tema, 'surface');
    const frenteDoBotao = corDaVariavel(tema, 'brand-foreground');
    assert.ok(contraste(texto, superficie) >= 4.5, `${nome}: texto de marca/superfície`);
    assert.ok(contraste(frenteDoBotao, preenchimento) >= 4.5, `${nome}: texto do botão/preenchimento de marca`);
  }
});

test('pares de texto, estado e foco cumprem WCAG AA nos dois temas', () => {
  const pares = [
    ['ink', 'ink', 'surface', 4.5],
    ['ink muted', 'ink-muted', 'surface', 4.5],
    ['ink muted em fundo rebaixado', 'ink-muted', 'surface-sunken', 4.5],
    ['ink subtle', 'ink-subtle', 'surface-muted', 4.5],
    ['marca no fundo suave', 'brand-text', 'brand-soft', 4.5],
    ['sucesso no fundo suave', 'success', 'success-soft', 4.5],
    ['aviso no fundo suave', 'warning', 'warning-soft', 4.5],
    ['erro no fundo suave', 'danger', 'danger-soft', 4.5],
    ['erro no botão', 'danger-foreground', 'danger', 4.5],
    ['informação no fundo suave', 'info', 'info-soft', 4.5],
    ['foco na superfície', 'focus', 'surface', 3],
    ['borda de campo na superfície', 'line-input', 'surface', 3],
    ['texto claro na navegação escura', 'ink-inverse', 'surface-inverse', 4.5],
  ] as const;
  const falhas = Object.entries(temas).flatMap(([temaNome, tema]) => pares
    .filter(([, frente, fundo, minimo]) => contraste(corDaVariavel(tema, frente), corDaVariavel(tema, fundo)) < minimo)
    .map(([nome, frente, fundo, minimo]) => `${temaNome}: ${nome} = ${contraste(corDaVariavel(tema, frente), corDaVariavel(tema, fundo)).toFixed(2)} < ${minimo}`));
  assert.deepEqual(falhas, []);
});

const gerarCss = async (html: string) => {
  const resultado = await postcss([tailwindcss({ ...config, content: [{ raw: html, extension: 'html' }] })]).process('@tailwind utilities;', { from: undefined });
  return resultado.css;
};

test('os tokens e o plugin de animação geram CSS: a classe existe de verdade', async () => {
  const css = await gerarCss('<div class="animate-in fade-in zoom-in-95 slide-in-from-bottom-2 slide-in-from-right bg-brand-fill text-brand text-ink-muted border-line rounded-control rounded-card rounded-modal max-w-panel min-w-chart shadow-modal font-sans font-mono motion-reduce:animate-none">');
  for (const seletor of ['.animate-in', '.fade-in', '.zoom-in-95', '.slide-in-from-bottom-2', '.slide-in-from-right', '.bg-brand-fill', '.text-brand', '.text-ink-muted', '.border-line', '.rounded-control', '.rounded-card', '.rounded-modal', '.max-w-panel', '.min-w-chart', '.shadow-modal']) {
    assert.ok(css.includes(seletor), `${seletor} não foi gerada`);
  }
  assert.match(css, /Geist Variable/);
  assert.match(css, /Geist Mono Variable/);
});

test('o lint do CI aplica os guardrails de estilos, inline e dependências de UI', () => {
  const eslint = readFileSync(join(raiz, 'eslint.config.js'), 'utf8');
  const pacote = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')) as { scripts: { lint: string } };
  assert.match(eslint, /design-system\/no-raw-design-values/);
  assert.match(eslint, /design-system\/no-inline-design-style/);
  assert.match(eslint, /design-system\/ui-boundary-imports/);
  assert.match(pacote.scripts.lint, /lint-design-system\.mjs/);
});

test('o menor texto da escala é de 12 px', () => {
  assert.equal(config.theme.extend.fontSize.xs[0], '0.75rem');
});

const arquivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
const codigo = arquivos(src).filter((arquivo) => /\.(tsx?|css)$/.test(arquivo));
const fonte = (arquivo: string) => readFileSync(arquivo, 'utf8');
const nome = (arquivo: string) => relative(src, arquivo);

test('nenhum alert() ou confirm() nativo no código do front-end', () => {
  const infratores = codigo.filter((arquivo) => /\balert\(|\bconfirm\(|window\.confirm/.test(fonte(arquivo))).map(nome);
  assert.deepEqual(infratores, []);
});

test('nenhum texto abaixo de 12 px em classe arbitrária', () => {
  const infratores = codigo.filter((arquivo) => /text-\[\s*(\d|1[01])(\.\d+)?px\s*\]/.test(fonte(arquivo))).map(nome);
  assert.deepEqual(infratores, []);
});

test('o código não usa classes que o Tailwind 3 não tem nem a paleta antiga primary e secondary', () => {
  const infratores = codigo.filter((arquivo) => /\bflex-2\b|\b(?:bg|text|border|ring|from|to|via|outline|shadow)-(?:primary|secondary)\b|custom-scrollbar/.test(fonte(arquivo))).map(nome);
  assert.deepEqual(infratores, []);
});

test('App.css não existe mais', () => {
  assert.equal(existsSync(join(src, 'App.css')), false);
  assert.deepEqual(codigo.filter((arquivo) => /App\.css/.test(fonte(arquivo))).map(nome), []);
});

// As rotas dentro do Layout (admin e portal) não têm <main> próprio; as que não passam pelo Layout têm um cada.
test('nenhuma página aninha <main>: só o Layout e as páginas fora dele (públicas e o cartão das etapas de acesso) o declaram', () => {
  const comMain = codigo.filter((arquivo) => /<main[\s>]/.test(fonte(arquivo))).map(nome).sort();
  assert.deepEqual(comMain, ['components/Auth/CartaoDeAcesso.tsx', 'layouts/Layout.tsx', 'pages/Auth/Login.tsx', 'pages/Landing/Home.tsx', 'pages/Legal/LegalPage.tsx']);
});

test('todo <label> do código tem htmlFor e toda <img> tem alt', () => {
  const semFor: string[] = [];
  const semAlt: string[] = [];
  for (const arquivo of codigo.filter((a) => a.endsWith('.tsx'))) {
    const texto = fonte(arquivo);
    for (const [tag] of texto.matchAll(/<label\b[^>]*>/g)) if (!/htmlFor/.test(tag)) semFor.push(`${nome(arquivo)}: ${tag}`);
    for (const [tag] of texto.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(tag)) semAlt.push(`${nome(arquivo)}: ${tag}`);
  }
  assert.deepEqual(semFor, []);
  assert.deepEqual(semAlt, []);
});

test('toda página de rota define o título da aba com usePageTitle', () => {
  const paginas = [
    'pages/Landing/Home.tsx', 'pages/Auth/Login.tsx', 'pages/Auth/TrocarSenha.tsx', 'pages/Auth/EsqueciSenha.tsx', 'pages/Auth/RedefinirSenha.tsx', 'pages/Legal/LegalPage.tsx',
    'pages/Admin/Dashboard.tsx', 'pages/Admin/Employees.tsx', 'pages/Admin/OrgStructure.tsx', 'pages/Admin/Payroll.tsx', 'pages/Admin/Company.tsx', 'pages/Admin/Users.tsx', 'pages/Admin/TimeTracking.tsx', 'pages/Admin/Reports.tsx',
    'pages/Portal/EmployeeDashboard.tsx', 'pages/Portal/Payslips.tsx', 'pages/Portal/Requests.tsx', 'pages/Portal/Profile.tsx',
  ];
  const semTitulo = paginas.filter((pagina) => !/usePageTitle\(/.test(fonte(join(src, pagina))));
  assert.deepEqual(semTitulo, []);
});
