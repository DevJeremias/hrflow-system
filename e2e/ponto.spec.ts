// Fluxo 1: o colaborador faz o primeiro acesso (a senha que o RH definiu é provisória e precisa ser trocada),
// entra com a senha nova e marca o ponto. O colaborador nasce pela API do administrador, para o fluxo valer
// em qualquer dia e quantas vezes for repetido (a sequência das marcações é por dia).
import { test, expect } from '@playwright/test';
import { ADMINISTRADOR, SENHA, emailUnico, entrar, sessaoDaApi } from './support/sessao';

const SENHA_NOVA = 'senha-nova-e2e-1';

test('o colaborador troca a senha provisória, entra, marca a entrada e o registro sobrevive ao recarregar a página', async ({ page, baseURL }) => {
  const email = emailUnico('ponto');
  const admin = await sessaoDaApi(baseURL as string, ADMINISTRADOR);
  const criado = await admin.post('/api/funcionarios', {
    data: { nome: 'Colaborador E2E Ponto', email, senha: SENHA, data_admissao: '2024-01-02' },
  });
  expect(criado.status()).toBe(201);
  await admin.dispose();

  // O primeiro acesso só abre a troca de senha; depois dela a pessoa volta ao login com a senha nova.
  await entrar(page, email, SENHA, /\/trocar-senha$/);
  await page.locator('[name="senhaAtual"]').fill(SENHA);
  await page.locator('[name="novaSenha"]').fill(SENHA_NOVA);
  await page.locator('[name="confirmacao"]').fill(SENHA_NOVA);
  await page.getByRole('button', { name: 'Definir senha' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('status').filter({ hasText: 'Senha definida' })).toBeVisible();

  await entrar(page, email, SENHA_NOVA, /\/meu-painel$/);
  await expect(page.getByText('Horário de Belém')).toBeVisible();
  await expect(page.getByText('Nenhum ponto registrado')).toBeVisible();

  await page.getByRole('button', { name: 'Registrar Entrada' }).click();

  const registros = page.getByRole('heading', { name: /Registros de Hoje/ }).locator('..');
  await expect(registros.getByText('1/4')).toBeVisible();
  await expect(registros.getByText('Entrada', { exact: true })).toBeVisible();
  // Depois da entrada o sistema oferece o próximo passo da jornada, não a entrada de novo.
  await expect(page.getByRole('button', { name: 'Registrar Entrada' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar Pausa Almoço' })).toBeVisible();

  await page.reload();
  await expect(registros.getByText('Entrada', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar Pausa Almoço' })).toBeVisible();
});
