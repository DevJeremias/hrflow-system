// Fluxo 3: o colaborador não reescreve o próprio nome: ele pede, o RH aprova em Aprovações, o nome muda e a
// trilha de Auditoria mostra quem aprovou, com o valor de antes e o de depois. O colaborador nasce pela API do
// administrador, para o fluxo valer quantas vezes for repetido.
import { test, expect } from '@playwright/test';
import { ADMINISTRADOR, RH, SENHA, emailUnico, entrar, sessaoDaApi, trocarSenhaProvisoria } from './support/sessao';

const SENHA_NOVA = 'senha-nova-e2e-3';

test('o colaborador pede a troca do nome, o RH aprova e a auditoria registra a mudança', async ({ page, browser, baseURL }) => {
  const sufixo = Date.now().toString(36);
  const nomeAntigo = `Colaborador E2E Perfil ${sufixo}`;
  const nomeNovo = `Colaborador E2E Renomeado ${sufixo}`;
  const email = emailUnico('perfil');

  const admin = await sessaoDaApi(baseURL as string, ADMINISTRADOR);
  const criado = await admin.post('/api/funcionarios', { data: { nome: nomeAntigo, email, senha: SENHA, data_admissao: '2024-01-02' } });
  expect(criado.status()).toBe(201);
  await admin.dispose();

  await trocarSenhaProvisoria(page, email, SENHA, SENHA_NOVA);
  await entrar(page, email, SENHA_NOVA, /\/meu-painel$/);

  // O colaborador pede; o nome em tela continua o de antes até a aprovação.
  await page.getByRole('link', { name: 'Meus Dados' }).click();
  await page.getByRole('button', { name: 'Editar Dados' }).click();
  await expect(page.getByText(/passam por aprovação do RH/)).toBeVisible();
  await page.locator('[name="name"]').fill(nomeNovo);
  await page.getByRole('button', { name: 'Salvar e enviar pedido' }).click();
  await expect(page.getByRole('status')).toContainText('Solicitação enviada');
  await expect(page.getByText('Seus pedidos de alteração')).toBeVisible();
  await expect(page.getByText('Aguardando decisão')).toBeVisible();
  await expect(page.getByRole('paragraph').filter({ hasText: nomeAntigo }).first()).toBeVisible();

  // O RH decide numa sessão própria.
  const contextoDoRh = await browser.newContext({ baseURL, locale: 'pt-BR', timezoneId: 'America/Belem' });
  const paginaDoRh = await contextoDoRh.newPage();
  await entrar(paginaDoRh, RH, SENHA, /\/admin$/);
  await paginaDoRh.getByRole('link', { name: 'Aprovações', exact: true }).click();
  const pedido = paginaDoRh.getByRole('article', { name: `Pedido de ${nomeAntigo}` });
  await expect(pedido).toContainText(nomeNovo);
  await pedido.getByRole('button', { name: /Aprovar/ }).click();
  await paginaDoRh.getByRole('dialog').getByRole('button', { name: 'Aprovar', exact: true }).click();
  await expect(paginaDoRh.getByRole('status').filter({ hasText: 'aprovado' })).toBeVisible();
  await expect(paginaDoRh.getByText('Nenhum pedido esperando decisão')).toBeVisible();

  // A trilha mostra a aprovação, de quem fez e o que mudou.
  await paginaDoRh.getByRole('link', { name: 'Auditoria', exact: true }).click();
  const linha = paginaDoRh.getByRole('row').filter({ hasText: 'Alteração aprovada' }).filter({ hasText: nomeNovo });
  await expect(linha).toHaveCount(1);
  await expect(linha).toContainText('Rita RH');
  await expect(linha).toContainText(`Nome: ${nomeAntigo} → ${nomeNovo}`);
  await contextoDoRh.close();

  // Com o nome aprovado, o colaborador o vê.
  await page.reload();
  await expect(page.getByRole('paragraph').filter({ hasText: nomeNovo }).first()).toBeVisible();
});
