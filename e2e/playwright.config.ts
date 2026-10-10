// Testes de ponta a ponta: navegador de verdade contra a API e o front-end de verdade, num MySQL
// criado por `npm run db:setup` (migrations e fixtures). Subir o banco, rodar o db:setup e instalar o
// Chromium (`npx playwright install chromium`) vem antes; o README da raiz tem o passo a passo.
// As portas ficam fora das do ambiente de desenvolvimento (3000 da API, 5173 do Vite) e mudam por variável.
import { defineConfig, devices } from '@playwright/test';

const API_PORT = Number(process.env.E2E_API_PORT ?? 3181);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3182);

export default defineConfig({
  testDir: '.',
  // Os fluxos compartilham um banco só e criam dados com nomes próprios: em fila, falham por um motivo só.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Belem',
    // O registro de ponto pede a localização; a de Belém vale como permissão concedida.
    geolocation: { latitude: -1.4558, longitude: -48.4902 },
    permissions: ['geolocation'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      locale: 'pt-BR',
      // Os controles nativos de mês seguem a localidade do processo do Chromium.
      launchOptions: { args: ['--lang=pt-BR'] },
    },
  }],
  webServer: [
    {
      // cwd em backend/: o dotenv lê o backend/.env de quem desenvolve; no CI as variáveis vêm do job.
      command: 'node server.ts',
      cwd: '../backend',
      env: { PORT: String(API_PORT) },
      url: `http://127.0.0.1:${API_PORT}/api/ready`,
      reuseExistingServer: false,
    },
    {
      cwd: '..',
      command: `npm run dev --workspace frontend -- --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      env: { VITE_API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
    },
  ],
});
