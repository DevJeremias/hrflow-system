// Atalhos dos fluxos: entrar pela tela de login como o usuário faria e preparar dados pela API.
// Usuários e senha vêm das fixtures de `npm run db:setup` (HRFLOW_SEED_PASSWORD muda a senha).
import { expect, request as playwrightRequest } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

export const SENHA = process.env.HRFLOW_SEED_PASSWORD ?? 'hrflow-dev-123';
export const ADMINISTRADOR = 'admin@alfa.exemplo.invalid';
export const RH = 'rita.rh@alfa.exemplo.invalid';

// Entra pela tela de login e espera chegar à rota inicial do perfil.
export const entrar = async (page: Page, email: string, senha = SENHA, rotaInicial: RegExp = /\/(admin|meu-painel)$/) => {
  await page.goto('/login');
  await page.getByPlaceholder('exemplo@email.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(senha);
  await page.getByRole('button', { name: 'ACESSAR SISTEMA' }).click();
  await expect(page).toHaveURL(rotaInicial);
};

// E-mail que não colide entre execuções nem entre fluxos: o banco é compartilhado e não se limpa.
export const emailUnico = (prefixo: string) => `${prefixo}.${Date.now().toString(36)}@e2e.exemplo.invalid`;

// Uma sessão de API, com o cabeçalho CSRF que o front-end mandaria nas requisições que mudam estado.
export const sessaoDaApi = async (baseURL: string, email: string, senha = SENHA): Promise<APIRequestContext> => {
  const api = await playwrightRequest.newContext({ baseURL });
  const login = await api.post('/api/auth/login', { data: { email, senha } });
  expect(login.ok(), `login de ${email} pela API`).toBeTruthy();
  const csrf = (await api.storageState()).cookies.find((cookie) => cookie.name === 'hrflow_csrf')?.value;
  expect(csrf, 'cookie de CSRF depois do login').toBeTruthy();
  return playwrightRequest.newContext({ baseURL, storageState: await api.storageState(), extraHTTPHeaders: { 'X-CSRF-Token': csrf as string } });
};
