// Fluxo 2: o RH cadastra um colaborador pela tela, processa a folha do mês e o encontra nela, com o holerite aberto.
// Os valores da folha não são fixados aqui (a regra de cálculo tem testes próprios): o que importa é o
// colaborador novo entrar no cálculo e o demonstrativo fechar a conta que ele mesmo mostra.
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
  await page.locator('[name="nomeCompleto"]').fill(nome);
  await page.locator('[name="emailPessoal"]').fill(email);
  await page.locator('[name="senhaAcesso"]').fill(SENHA);

  await page.getByRole('button', { name: /Contrato/i }).click();
  await page.locator('[name="dataAdmissao"]').fill('2025-03-03');
  await page.locator('[name="cargoId"]').selectOption({ index: 1 });
  await page.locator('[name="departamentoId"]').selectOption({ index: 1 });
  await page.locator('[name="salarioBase"]').fill('3000');

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

  await linha.click();
  const holerite = page.getByRole('dialog', { name: 'Detalhes do Holerite' });
  await expect(holerite).toContainText(nome);
  await expect(holerite).toContainText('Salário Base');
});
