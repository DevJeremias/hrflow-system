// O holerite aberto em modal: a semântica de diálogo (o que o leitor de tela e o foco precisam) e o que
// o demonstrativo mostra. É o modal de gestão que já nasce como diálogo; os outros precisam chegar aqui.
import { dom, abrirVite, limparTela } from './support/componentes.ts';
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, type ComponentType } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ViteDevServer } from 'vite';

type Props = { isOpen: boolean; onClose: () => void; employee: Record<string, unknown> | null; month: string; companyName?: string };

const FUNCIONARIA = {
  id: '7', name: 'Bia Ficticia', role: 'Analista', department: 'Pessoas',
  baseSalary: 3000, totalEarnings: 0, totalDeductions: 248.6, totalGross: 3000, netSalary: 2751.4, employerCharges: 600,
  earningsList: [{ description: 'Gratificação', value: 100, isPercentage: false }],
  deductionsList: [{ description: 'INSS', value: 248.6, isPercentage: false }],
};

let server: ViteDevServer;
let PayrollSlipModal: ComponentType<Props>;
let fechamentos: number;
let impressoes: number;

before(async () => {
  server = await abrirVite();
  ({ default: PayrollSlipModal } = await server.ssrLoadModule('/src/components/Admin/PayrollSlipModal.tsx'));
  dom.window.print = () => { impressoes += 1; };
});

after(async () => {
  await server.close();
  dom.window.close();
});

afterEach(() => {
  limparTela();
});

const abrir = (props: Partial<Props> = {}) => {
  fechamentos = 0;
  impressoes = 0;
  render(createElement(PayrollSlipModal, {
    isOpen: true, onClose: () => { fechamentos += 1; }, employee: FUNCIONARIA, month: 'outubro de 2026', companyName: 'Empresa Ficticia Alfa Ltda', ...props,
  }));
};

test('fechado, ou sem colaborador, não renderiza nada', () => {
  abrir({ isOpen: false });
  assert.equal(screen.queryByRole('dialog'), null);
  limparTela();
  abrir({ employee: null });
  assert.equal(screen.queryByRole('dialog'), null);
});

test('é um diálogo modal com nome acessível', () => {
  abrir();
  const dialogo = screen.getByRole('dialog', { name: 'Detalhes do Holerite' });
  assert.equal(dialogo.getAttribute('aria-modal'), 'true');
});

test('mostra a empresa, a competência, o colaborador e a conta do demonstrativo', () => {
  abrir();
  const dialogo = screen.getByRole('dialog');
  const texto = dialogo.textContent ?? '';
  assert.match(texto, /Empresa Ficticia Alfa Ltda/);
  assert.match(texto, /Referência: outubro de 2026/);
  assert.match(texto, /0007 - Bia Ficticia/);
  assert.match(texto, /Pessoas/);
  assert.match(texto, /Analista/);
  for (const descricao of ['Salário Base', 'Gratificação', 'INSS']) assert.ok(within(dialogo).getAllByText(descricao).length > 0, descricao);
  assert.ok(within(dialogo).getAllByText(/R\$\s*2\.751,40/).length > 0, 'líquido');
  assert.ok(within(dialogo).getAllByText(/R\$\s*248,60/).length > 0, 'desconto do INSS');
});

test('sem o nome da empresa na sessão, não inventa um', () => {
  abrir({ companyName: undefined });
  assert.equal(screen.getByRole('dialog').querySelector('h1'), null);
});

test('o botão de imprimir chama a impressão do navegador', async () => {
  abrir();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Imprimir Holerite' }));
  assert.equal(impressoes, 1);
});

test('o X e o fundo escuro fecham o diálogo', async () => {
  abrir();
  const usuario = userEvent.setup();
  const dialogo = screen.getByRole('dialog');
  const botoes = within(dialogo).getAllByRole('button');
  await usuario.click(botoes[botoes.length - 1]);
  assert.equal(fechamentos, 1);

  await usuario.click(document.querySelector('[data-modal-backdrop]') as Element);
  assert.equal(fechamentos, 2);
});
