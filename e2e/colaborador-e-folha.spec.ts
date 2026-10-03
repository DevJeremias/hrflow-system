// Fluxo 2: o RH cadastra um colaborador pela tela, processa a folha do mês e o encontra nela, com o holerite aberto.
// Os valores da folha não são fixados aqui (a regra de cálculo tem testes próprios): o que importa é o
// colaborador novo entrar no cálculo e o demonstrativo fechar a conta que ele mesmo mostra.
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { RH, SENHA, emailUnico, entrar } from './support/sessao';

// O valor da célula sem o sinal de "+" ou "-" que a tabela imprime e sem a moeda: "- R$ 1.234,50" vira 1234.5.
const reais = (texto: string) => Number(texto.replace(/[^\d,]/g, '').replace(',', '.'));

test('o RH cadastra um colaborador e ele aparece na folha com o líquido calculado', async ({ page }) => {
  const nome = `Colaborador E2E Folha ${Date.now().toString(36)}`;
  const email = emailUnico('folha');

  await entrar(page, RH, SENHA, /\/admin$/);
  await page.getByRole('link', { name: 'Colaboradores', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/colaboradores$/);

  await page.getByRole('button', { name: /Adicionar Colaborador/ }).click();
  const cadastro = page.getByRole('dialog');
  await cadastro.getByLabel('Nome Completo').fill(nome);
  await cadastro.getByLabel('E-mail Pessoal').fill(email);
  await cadastro.getByLabel('Senha Provisória').fill(SENHA);

  await cadastro.getByRole('tab', { name: 'Contrato' }).click();
  await cadastro.getByLabel('Data de Admissão').fill('2025-03-03');
  await cadastro.getByLabel('Cargo').selectOption({ index: 1 });
  await cadastro.getByLabel('Setor / Departamento').selectOption({ index: 1 });
  await cadastro.getByLabel('Salário Base (Bruto)').fill('3000');

  await page.getByRole('button', { name: 'Confirmar Cadastro' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar Cadastro' })).toHaveCount(0);
  await expect(page.getByText(nome).first()).toBeVisible();

  await page.getByRole('link', { name: 'Folha de Pagamento' }).click();
  await expect(page).toHaveURL(/\/admin\/folha$/);
  // A folha é por competência: a do mês corrente existe depois de processada (ou reprocessada, se outro fluxo já a abriu).
  await page.getByRole('button', { name: /Processar (folha|novamente)/ }).click();
  await expect(page.getByText('Folha aberta')).toBeVisible();
  await page.getByPlaceholder('Buscar colaborador...').fill(nome);

  const linha = page.getByRole('row').filter({ hasText: nome });
  await expect(linha).toHaveCount(1);
  const [, salario, proventos, descontos, liquido] = await linha.getByRole('cell').allInnerTexts();
  expect(reais(salario)).toBe(3000);
  expect(reais(descontos)).toBeGreaterThan(0);
  expect(reais(liquido)).toBeCloseTo(reais(salario) + reais(proventos) - reais(descontos), 2);

  // O PDF da folha vem do servidor, uma página por colaborador, e chega ao navegador como arquivo.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar PDF dos holerites' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^holerites-\d{4}-\d{2}\.pdf$/);
  expect((await readFile(await download.path())).subarray(0, 5).toString()).toBe('%PDF-');

  await linha.getByRole('button', { name: `Ver holerite de ${nome}` }).click();
  const holerite = page.getByRole('dialog', { name: 'Detalhes do Holerite' });
  await expect(holerite).toContainText(nome);
  await expect(holerite).toContainText('Salário Base');
  await expect(holerite).toContainText('Base INSS');
});
