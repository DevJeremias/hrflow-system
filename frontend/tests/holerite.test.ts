// Holerite (B-07): empresa e competência reais, e um layout que não depende de 600 px de largura.
// jsdom não calcula layout; a medição em 360 px é feita no navegador (ver PR). Aqui ficam o conteúdo
// e a estrutura responsiva que a tornam possível.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { createElement, act, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer, type ViteDevServer } from 'vite';
import { competenciaAtual } from '../src/utils/competencia.ts';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
});

let server: ViteDevServer;
let Modal: ComponentType<Record<string, unknown>>;

before(async () => {
  server = await createServer({ configFile: './vite.config.js', server: { middlewareMode: true }, appType: 'custom' });
  ({ default: Modal } = await server.ssrLoadModule('/src/components/Admin/PayrollSlipModal.tsx'));
});

after(async () => {
  await server.close();
  dom.window.close();
});

const funcionario = {
  id: '7', name: 'Caio Colaborador Ficticio', role: 'Analista', department: 'Tecnologia',
  baseSalary: 6800, totalEarnings: 300, totalDeductions: 1234.56, totalGross: 7100, netSalary: 5865.44, employerCharges: 0,
  earningsList: [{ description: 'Adicional de teste', value: 300, isPercentage: false }],
  deductionsList: [{ description: 'INSS', value: 1234.56, isPercentage: false }],
};

const abrir = async (props: Record<string, unknown>) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(Modal, { isOpen: true, onClose: () => {}, employee: funcionario, ...props })); });
  const fechar = async () => { await act(async () => root.unmount()); host.remove(); };
  return { fechar, modal: document.querySelector('.holerite-impressao') as HTMLElement };
};

test('a competência é o mês corrente por extenso, em minúsculas', () => {
  assert.equal(competenciaAtual(new Date(2026, 9, 2)), 'outubro de 2026');
  assert.equal(competenciaAtual(new Date(2027, 0, 31)), 'janeiro de 2027');
  assert.equal(competenciaAtual(new Date(2026, 2, 1)), 'março de 2026');
});

test('o título traz a competência e o nome da empresa vem da sessão', async () => {
  const { fechar, modal } = await abrir({ month: competenciaAtual(new Date(2026, 9, 2)), companyName: 'Empresa Ficticia Alfa Ltda' });
  const texto = modal.textContent ?? '';
  assert.match(texto, /Referência: outubro de 2026/);
  assert.match(texto, /Empresa Ficticia Alfa Ltda/);
  assert.doesNotMatch(texto, /CNPJ/, 'sem coluna em empresas, a linha do CNPJ não aparece');
  const titulo = [...modal.querySelectorAll('p')].find((p) => p.textContent?.startsWith('Referência:'));
  assert.doesNotMatch(titulo?.className ?? '', /capitalize/, 'capitalize transformaria "de" em "De"');
  await fechar();
});

test('sem nome de empresa na sessão não inventa um', async () => {
  const { fechar, modal } = await abrir({ month: 'outubro de 2026' });
  assert.equal(modal.querySelector('h1'), null);
  await fechar();
});

test('todos os valores aparecem na lista empilhada do celular e na tabela', async () => {
  const { fechar, modal } = await abrir({ month: 'outubro de 2026', companyName: 'Empresa Ficticia Alfa Ltda' });
  const lista = modal.querySelector('ul');
  const tabela = modal.querySelector('table');
  assert.ok(lista && tabela);
  assert.match(lista.className, /\bsm:hidden\b/, 'a lista só aparece abaixo de sm');
  assert.match(tabela.parentElement?.className ?? '', /\bhidden\b.*\bsm:block\b.*\boverflow-x-auto\b/, 'a tabela só aparece de sm para cima, com rolagem de segurança');
  for (const valor of ['R$ 6.800,00', 'R$ 300,00', 'R$ 1.234,56']) {
    const normal = (texto: string) => texto.replace(/\s/g, ' ');
    assert.ok(normal(lista.textContent ?? '').includes(valor), `a lista deve mostrar ${valor}`);
    assert.ok(normal(tabela.textContent ?? '').includes(valor), `a tabela deve mostrar ${valor}`);
  }
  assert.match(lista.textContent ?? '', /Vencimento/);
  assert.match(lista.textContent ?? '', /Desconto/);
  await fechar();
});

test('nenhuma grade do holerite fixa três ou mais colunas sem variante responsiva', async () => {
  const { fechar, modal } = await abrir({ month: 'outubro de 2026' });
  for (const elemento of modal.querySelectorAll('[class*="grid-cols-"]')) {
    const fixas = elemento.className.split(/\s+/).filter((c) => /^grid-cols-([3-9]|1\d)$/.test(c));
    assert.deepEqual(fixas, [], `grade fixa: ${elemento.className}`);
  }
  assert.ok(modal.querySelector('.grid-cols-1.sm\\:grid-cols-2'), 'os totais empilham abaixo de sm');
  await fechar();
});

test('o código não traz mais empresa nem CNPJ de exemplo', () => {
  const arquivos = (dir: string): string[] => readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
  for (const arquivo of arquivos('src').filter((a) => /\.(tsx?|css|html)$/.test(a))) {
    const conteudo = readFileSync(arquivo, 'utf8');
    assert.doesNotMatch(conteudo, /Sua Empresa S\/A/, arquivo);
    assert.doesNotMatch(conteudo, /00\.000\.000\/0001-00/, arquivo);
    assert.doesNotMatch(conteudo, /Abril de 2026/, arquivo);
  }
});

test('o holerite é um diálogo modal nomeado e o botão de imprimir tem nome acessível', async () => {
  const { fechar } = await abrir({ month: 'outubro de 2026' });
  const dialogo = document.querySelector('[role="dialog"]')!;
  assert.equal(dialogo.getAttribute('aria-modal'), 'true');
  assert.equal(document.getElementById(dialogo.getAttribute('aria-labelledby')!)?.textContent, 'Detalhes do Holerite');
  assert.ok(dialogo.querySelector('button[aria-label="Imprimir Holerite"]'));
  assert.ok(dialogo.closest('.holerite-impressao'), 'o contêiner do modal leva a classe que o CSS de impressão preserva');
  await fechar();
});
