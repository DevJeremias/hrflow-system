// Landing e páginas legais: o texto público só descreve o que o produto faz hoje, o menu e o login
// existem no celular, o carrossel pode ser pausado e Termos e Privacidade são páginas reais.
import { after, afterEach, before, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { createElement, act, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createServer, type ViteDevServer } from 'vite';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  localStorage: { configurable: true, value: dom.window.localStorage },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
});
dom.window.scrollTo = () => {};
dom.window.Element.prototype.scrollIntoView = () => {};

const definirMenosMovimento = (reduzido: boolean) => {
  dom.window.matchMedia = ((consulta: string) => ({
    matches: reduzido && consulta.includes('prefers-reduced-motion'),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof dom.window.matchMedia;
};

const raiz = new URL('..', import.meta.url).pathname;
const paginas = join(raiz, 'src/pages');

let server: ViteDevServer;
let App: ComponentType;
let AuthProvider: ComponentType<{ children: unknown }>;

before(async () => {
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true, ws: false }, appType: 'custom' });
  ({ default: App } = await server.ssrLoadModule('/src/App.tsx'));
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'));
});

afterEach(() => mock.timers.reset());

after(async () => {
  await server.close();
  dom.window.close();
});

const renderizar = async (rota: string) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const cliente = new QueryClient();
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client: cliente },
        createElement(MemoryRouter, { initialEntries: [rota] },
          createElement(AuthProvider, null, createElement(App)))),
    );
  });
  return { host, fechar: async () => { await act(async () => root.unmount()); host.remove(); } };
};

const arquivosDe = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivosDe(join(dir, e.name)) : [join(dir, e.name)]));

test('a landing não promete o que o produto não faz', () => {
  const proibido = /IRRF|backups autom|ponta a ponta|LGPD Compliance|YouRH|RHPRO|R\$ 2B|2\.000 empresas|500 empresas|IA Preditiva|9BOX|Solicitar Demonstra|solicitar demonstra/i;
  for (const arquivo of arquivosDe(join(paginas, 'Landing'))) {
    assert.doesNotMatch(readFileSync(arquivo, 'utf8'), proibido, arquivo);
  }
});

test('Navbar e Footer não têm links vazios', () => {
  for (const nome of ['Navbar.tsx', 'Footer.tsx']) {
    assert.doesNotMatch(readFileSync(join(paginas, 'Landing', nome), 'utf8'), /href\s*=\s*["'{`]*#["'}`]/, nome);
  }
});

test('o menu do celular expõe Entrar e Criar conta', async () => {
  definirMenosMovimento(false);
  const { host, fechar } = await renderizar('/');
  const cabecalho = host.querySelector('header')!;
  assert.equal(cabecalho.querySelector('#menu-mobile'), null);
  const botao = cabecalho.querySelector<HTMLButtonElement>('button[aria-controls="menu-mobile"]');
  assert.ok(botao, 'deve existir um botão de menu');
  assert.equal(botao.getAttribute('aria-expanded'), 'false');
  assert.match(botao.className, /md:hidden/, 'o botão só aparece abaixo de md');

  await act(async () => { botao.click(); });
  assert.equal(botao.getAttribute('aria-expanded'), 'true');
  const menu = cabecalho.querySelector('#menu-mobile')!;
  const entrar = [...menu.querySelectorAll('a')].find((a) => a.textContent === 'Entrar');
  assert.equal(entrar?.getAttribute('href'), '/login');
  const criar = [...menu.querySelectorAll('a')].find((a) => a.textContent === 'Criar conta');
  assert.equal(criar?.getAttribute('href'), '/#contato');
  await fechar();
});

test('o carrossel avança sozinho e pode ser pausado', async () => {
  definirMenosMovimento(false);
  mock.timers.enable({ apis: ['setInterval'] });
  const { host, fechar } = await renderizar('/');
  const pontos = () => [...host.querySelectorAll('button[aria-label^="Ir para o slide"]')];
  const atual = () => pontos().findIndex((p) => p.getAttribute('aria-current') === 'true');
  assert.equal(atual(), 0);

  await act(async () => { mock.timers.tick(6000); });
  assert.equal(atual(), 1);

  const pausar = host.querySelector<HTMLButtonElement>('button[aria-label^="Pausar"]');
  assert.ok(pausar, 'deve existir um botão de pausa');
  await act(async () => { pausar.click(); });
  await act(async () => { mock.timers.tick(30000); });
  assert.equal(atual(), 1, 'pausado, o slide não muda');

  const retomar = host.querySelector<HTMLButtonElement>('button[aria-label^="Retomar"]');
  assert.ok(retomar);
  await act(async () => { retomar.click(); });
  await act(async () => { mock.timers.tick(6000); });
  assert.equal(atual(), 2);
  await fechar();
});

test('com prefers-reduced-motion o carrossel começa parado', async () => {
  definirMenosMovimento(true);
  mock.timers.enable({ apis: ['setInterval'] });
  const { host, fechar } = await renderizar('/');
  await act(async () => { mock.timers.tick(60000); });
  const pontos = [...host.querySelectorAll('button[aria-label^="Ir para o slide"]')];
  assert.equal(pontos.findIndex((p) => p.getAttribute('aria-current') === 'true'), 0);
  assert.ok(host.querySelector('button[aria-label^="Retomar"]'), 'o usuário ainda pode retomar a rotação');
  assert.match(host.querySelector('section[aria-roledescription="carrossel"] > div')!.className, /motion-reduce:transition-none/);
  await fechar();
});

test('os botões do hero levam ao cadastro, que cria conta', async () => {
  definirMenosMovimento(false);
  const { host, fechar } = await renderizar('/');
  const botoes = [...host.querySelectorAll('section[aria-roledescription="carrossel"] a')];
  assert.ok(botoes.length > 0);
  for (const botao of botoes) {
    assert.equal(botao.getAttribute('href'), '/#contato');
    assert.equal(botao.textContent, 'Criar conta');
  }
  assert.ok(host.querySelector('#contato form'), 'o destino é um formulário de cadastro');
  assert.equal(host.querySelectorAll('h1').length, 3);
  await fechar();
});

for (const [caminho, titulo, trecho] of [
  ['/termos', 'Termos de Uso', /Responsabilidade da empresa/],
  ['/privacidade', 'Política de Privacidade', /Direitos do titular/],
] as const) {
  test(`${caminho} é uma página real, aberta pelo rodapé`, async () => {
    definirMenosMovimento(false);
    const { host, fechar } = await renderizar('/');
    const link = [...host.querySelectorAll('footer a')].find((a) => a.getAttribute('href') === caminho);
    assert.ok(link, `o rodapé deve apontar para ${caminho}`);
    await act(async () => { (link as HTMLAnchorElement).click(); });
    assert.equal(host.querySelector('h1')?.textContent, titulo);
    assert.match(host.textContent ?? '', trecho);
    assert.ok(host.querySelector('header'), 'a página legal mantém o menu');
    await fechar();
  });
}
