// Contrato do design system: tokens com contraste AA, utilitários gerados e regras de código que impedem a
// volta dos problemas que a auditoria encontrou (alert nativo, texto minúsculo, label solto, <main> aninhado).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import config from '../tailwind.config.js';

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

const cores = config.theme.extend.colors as Record<string, Record<string, string>>;
const BRANCO = cores.surface.DEFAULT;

test('brand sobre branco tem contraste de pelo menos 4,5 (e o branco sobre brand também)', () => {
  assert.equal(cores.brand.DEFAULT, '#4f46e5');
  assert.ok(contraste(cores.brand.DEFAULT, BRANCO) >= 4.5, `brand/branco = ${contraste(cores.brand.DEFAULT, BRANCO).toFixed(2)}`);
  assert.ok(contraste(BRANCO, cores.brand.hover) >= 4.5);
});

test('todo par de texto e fundo dos tokens cumpre WCAG AA', () => {
  const pares: [string, string, string, number][] = [
    ['ink', cores.ink.DEFAULT, BRANCO, 4.5],
    ['ink-muted sobre branco', cores.ink.muted, BRANCO, 4.5],
    ['ink-muted sobre surface-sunken', cores.ink.muted, cores.surface.sunken, 4.5],
    ['ink-subtle sobre branco', cores.ink.subtle, BRANCO, 4.5],
    ['ink-subtle sobre surface-muted', cores.ink.subtle, cores.surface.muted, 4.5],
    ['brand sobre brand-soft', cores.brand.DEFAULT, cores.brand.soft, 4.5],
    ['success sobre soft', cores.success.DEFAULT, cores.success.soft, 4.5],
    ['warning sobre soft', cores.warning.DEFAULT, cores.warning.soft, 4.5],
    ['danger sobre soft', cores.danger.DEFAULT, cores.danger.soft, 4.5],
    ['danger sobre branco', cores.danger.DEFAULT, BRANCO, 4.5],
    ['branco sobre danger', BRANCO, cores.danger.DEFAULT, 4.5],
    ['info sobre soft', cores.info.DEFAULT, cores.info.soft, 4.5],
    ['branco sobre a barra lateral', BRANCO, cores.surface.inverse, 4.5],
    ['slate-300 sobre a barra lateral', '#cbd5e1', cores.surface.inverse, 4.5],
    ['borda de campo sobre branco (componente de interface)', cores.line.input, BRANCO, 3],
  ];
  const falhas = pares.filter(([, frente, fundo, minimo]) => contraste(frente, fundo) < minimo).map(([nome, frente, fundo]) => `${nome}: ${contraste(frente, fundo).toFixed(2)}`);
  assert.deepEqual(falhas, []);
});

const gerarCss = async (html: string) => {
  const resultado = await postcss([tailwindcss({ ...config, content: [{ raw: html, extension: 'html' }] })]).process('@tailwind utilities;', { from: undefined });
  return resultado.css;
};

test('os tokens e o plugin de animação geram CSS: a classe existe de verdade', async () => {
  const css = await gerarCss('<div class="animate-in fade-in zoom-in-95 slide-in-from-bottom-2 bg-brand text-ink-muted border-line rounded-control rounded-card rounded-modal shadow-modal font-sans motion-reduce:animate-none">');
  for (const seletor of ['.animate-in', '.fade-in', '.zoom-in-95', '.slide-in-from-bottom-2', '.bg-brand', '.text-ink-muted', '.border-line', '.rounded-control', '.rounded-card', '.rounded-modal', '.shadow-modal']) {
    assert.ok(css.includes(seletor), `${seletor} não foi gerada`);
  }
  assert.match(css, /Inter Variable/);
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
