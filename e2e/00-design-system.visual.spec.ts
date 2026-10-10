import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { ADMINISTRADOR, entrar, SENHA } from './support/sessao';

const LARGURAS = [360, 1280] as const;
const CABEÇALHOS = { 'X-Total-Count': '2' };
const RESUMO = { colaboradoresAtivos: 248, colaboradoresInativos: 6, departamentos: 5, cargos: 41, marcacoesHoje: 212 };
const HEADCOUNT = [221, 223, 224, 227, 229, 232, 233, 236, 239, 241, 245, 248].map((ativos, indice) => ({
  mes: ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'][indice],
  admitidos: indice === 11 ? 4 : 0,
  desligados: indice === 11 ? 1 : 0,
  ativos,
  turnover: indice === 11 ? 0.4 : 0,
}));
const FUNCIONARIOS = [{
  id: 2,
  nome: 'Caio Colaborador Ficticio',
  email: 'caio@alfa.exemplo.invalid',
  telefone: null,
  cpf: null,
  cargo_id: 1,
  cargo_nome: 'Desenvolvedor(a)',
  departamento_id: 1,
  departamento_nome: 'Tecnologia da Informação (TI)',
  status: 'Ativo',
  data_admissao: '2020-01-02',
  data_nascimento: null,
  data_desligamento: null,
  motivo_desligamento: null,
  endereco: null,
  matricula: '0002',
  rg: null,
  pis: null,
  ctps: null,
  cep: null,
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: null,
  cidade: null,
  uf: null,
  contato_emergencia_nome: null,
  contato_emergencia_telefone: null,
  contato_emergencia_parentesco: null,
  banco: null,
  agencia: null,
  conta: null,
  tipo_conta: null,
  nivel: null,
  tipo_contrato: 'CLT',
  salario_base: 6800,
  usuario_perfil: 'Colaborador',
  tem_movimento: true,
  anonimizado: false,
}];
const FUNCIONARIO_DA_FOLHA = {
  id: '2',
  name: 'Caio Colaborador Ficticio',
  role: 'Desenvolvedor(a)',
  department: 'Tecnologia da Informação (TI)',
  contract: 'CLT',
  baseSalary: 6800,
  totalEarnings: 6800,
  totalDeductions: 2089.09,
  totalGross: 6800,
  netSalary: 4710.91,
  employerCharges: 1449.6,
  inss: 563.11,
  irrf: 165.98,
  fgts: 544,
  dependents: 0,
  bases: { inss: 5440, fgts: 5440, irrf: 4832.8 },
  lancamentos: { adiantamento: 0, valeTransporte: 0, valeRefeicao: 0, planoSaude: 0 },
  earningsList: [{ description: 'Salário Base', value: 6800, isPercentage: false, reference: '30 dias' }],
  deductionsList: [
    { description: 'Desconto INSS', value: 563.11, isPercentage: false, reference: null },
    { description: 'IRRF', value: 165.98, isPercentage: false, reference: null },
    { description: 'Faltas', value: 1360, isPercentage: false, reference: '6 dias' },
  ],
  chargesList: [],
};
const HOLERITE_PORTAL = {
  ...FUNCIONARIO_DA_FOLHA,
  competencia: '2026-09',
  empresa: { razaoSocial: 'Empresa Ficticia Alfa Ltda', cnpj: '12345678000190' },
};
const FOLHA = {
  competencia: '2026-10',
  status: 'aberta',
  processadaEm: '2026-10-10T12:00:00.000Z',
  fechadaEm: null,
  empresa: { razaoSocial: 'Empresa Ficticia Alfa Ltda', cnpj: '12345678000190' },
  regimeTributario: 'Simples Nacional',
  totais: { bruto: 6800, descontos: 2089.09, liquido: 4710.91, encargos: 1449.6, inss: 563.11, irrf: 165.98, fgts: 544 },
  itens: [FUNCIONARIO_DA_FOLHA],
  pendencias: [],
};
const MARCACOES = [
  { id: 1, funcionario_id: 2, tipo_registro: 'Entrada', nome_funcionario: 'Caio Colaborador Ficticio', date: '2026-10-10', time: '08:00:00' },
  { id: 2, funcionario_id: 2, tipo_registro: 'Saída', nome_funcionario: 'Caio Colaborador Ficticio', date: '2026-10-10', time: '17:00:00' },
];
const EMPRESA = {
  nome: 'Empresa Ficticia Alfa Ltda',
  razao_social: 'Empresa Ficticia Alfa Ltda',
  cnpj: '12345678000190',
  regime_tributario: 'Simples Nacional',
  fuso: 'America/Belem',
  encarregado_nome: 'Joana Ficticia',
  encarregado_email: 'privacidade@alfa.exemplo.invalid',
};
const DEPARTAMENTOS = [{
  id: 1,
  nome: 'Tecnologia da Informação',
  sigla: 'TI',
  descricao: 'Sistemas internos, infraestrutura e suporte aos colaboradores.',
  gestor: 'Caio Colaborador Ficticio',
  total_colaboradores: 24,
  colaboradores_ativos: 22,
  total_cargos: 5,
}];
const CARGOS = [{
  id: 1,
  nome: 'Desenvolvedor(a)',
  departamento_id: 1,
  departamento_nome: 'Tecnologia da Informação',
  nivel: 'Pleno',
  salario_base: '6800.00',
  ocupantes: 6,
}];

const json = (route: Route, value: unknown, headers: Record<string, string> = {}) =>
  route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify(value) });

const instalarDadosVisuais = async (page: Page) => {
  await page.route('**/api/dashboard/resumo', (route) => json(route, RESUMO));
  await page.route('**/api/empresa', (route) => json(route, EMPRESA));
  await page.route('**/api/estrutura/departamentos', (route) => json(route, DEPARTAMENTOS));
  await page.route('**/api/estrutura/cargos', (route) => json(route, CARGOS));
  await page.route('**/api/relatorios/headcount**', (route) => json(route, HEADCOUNT));
  await page.route('**/api/relatorios/aniversariantes**', (route) => json(route, []));
  await page.route('**/api/notificacoes**', (route) => json(route, { naoLidas: 0, itens: [] }));
  await page.route('**/api/funcionarios**', async (route) => {
    const request = route.request();
    if (request.method() !== 'GET' || new URL(request.url()).pathname !== '/api/funcionarios') return route.continue();
    return json(route, FUNCIONARIOS, { 'X-Total-Count': '1' });
  });
  await page.route('**/api/folha/competencias/2026-10**', async (route) => {
    const request = route.request();
    const method = request.method();
    const caminho = new URL(request.url()).pathname;
    if (method === 'GET' && caminho === '/api/folha/competencias/2026-10') return json(route, FOLHA);
    if (method === 'POST' && caminho === '/api/folha/competencias/2026-10/processar') return json(route, FOLHA);
    return route.continue();
  });
  await page.route('**/api/ponto**', async (route) => {
    const request = route.request();
    const method = request.method();
    const caminho = new URL(request.url()).pathname;
    if (method === 'GET' && caminho === '/api/ponto') return json(route, MARCACOES, CABEÇALHOS);
    if (method === 'GET' && caminho === '/api/ponto/justificativas') return json(route, []);
    return route.continue();
  });
};

const esperarTela = async (page: Page) => {
  await expect(page.locator('main h1').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
};
// A rasterização tipográfica da landing varia em poucos pixels entre o Chromium local e o CI.
const capturarTela = (page: Page, nome: string, largura: number) =>
  expect(page).toHaveScreenshot(`${nome}-${largura}.png`, { maxDiffPixels: nome === 'landing' ? 100 : undefined });

for (const largura of LARGURAS) {
  test(`screenshots dos fluxos principais em ${largura}px`, async ({ page, browser, baseURL }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: largura, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install({ time: new Date('2026-10-10T12:00:00.000Z') });
    await instalarDadosVisuais(page);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Do cadastro ao holerite, no mesmo lugar.' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await capturarTela(page, 'landing', largura);

    await page.goto('/login');
    await esperarTela(page);
    await capturarTela(page, 'login', largura);

    await page.goto('/termos');
    await esperarTela(page);
    await capturarTela(page, 'termos', largura);

    await page.goto('/privacidade');
    await esperarTela(page);
    await capturarTela(page, 'privacidade', largura);

    await entrar(page, ADMINISTRADOR);
    await esperarTela(page);
    await capturarTela(page, 'admin-dashboard', largura);

    await page.goto('/admin/colaboradores');
    await esperarTela(page);
    await capturarTela(page, 'admin-colaboradores', largura);
    await page.getByRole('button', { name: /Adicionar Colaborador/i }).click();
    await expect(page.getByRole('dialog', { name: 'Novo Colaborador' })).toBeVisible();
    await capturarTela(page, 'admin-colaborador-painel', largura);

    await page.keyboard.press('Escape');

    await page.goto('/admin/estrutura');
    await esperarTela(page);
    await capturarTela(page, 'admin-estrutura-departamentos', largura);
    await page.getByRole('tab', { name: /Cargos e Funções/ }).click();
    await expect(page.getByRole('table', { name: 'Cargos da empresa' })).toBeVisible();
    await capturarTela(page, 'admin-estrutura-cargos', largura);

    await page.goto('/admin/empresa');
    await esperarTela(page);
    await expect(page.getByLabel('Razão social')).toHaveValue(EMPRESA.razao_social);
    await capturarTela(page, 'admin-empresa', largura);

    await page.goto('/admin/folha');
    await esperarTela(page);
    await page.getByRole('button', { name: /Processar (folha|novamente)/ }).click();
    await expect(page.getByText('Folha aberta')).toBeVisible();
    await expect(page.getByRole('button', { name: /Ver holerite de/ }).first()).toBeVisible();
    await page.getByText(/Processada em/).evaluate((element) => {
      element.textContent = 'Processada em 10/10/2026 às 00:00. Alterações no cadastro só entram ao processar de novo.';
    });
    await capturarTela(page, 'admin-folha', largura);
    await page.getByRole('button', { name: /Ver holerite de/ }).first().click();
    await expect(page.getByRole('dialog', { name: 'Detalhes do Holerite' })).toBeVisible();
    await capturarTela(page, 'admin-holerite', largura);
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();

    await page.goto('/admin/gestao-ponto');
    await esperarTela(page);
    await capturarTela(page, 'admin-ponto', largura);

    const portalContext = await browser.newContext({
      baseURL: baseURL as string,
      viewport: { width: largura, height: 900 },
      locale: 'pt-BR',
      timezoneId: 'America/Belem',
      reducedMotion: 'reduce',
      geolocation: { latitude: -1.4558, longitude: -48.4902 },
      permissions: ['geolocation'],
    });
    const portal = await portalContext.newPage();
    await portal.clock.install({ time: new Date('2026-10-10T08:00:00.000Z') });
    await portal.route('**/api/notificacoes**', (route) => json(route, { naoLidas: 0, itens: [] }));
    await portal.route('**/api/ponto/hoje/**', (route) => json(route, []));
    await portal.route('**/api/ponto/historico/**', (route) => json(route, []));
    await portal.route('**/api/ponto/totais/**', (route) => json(route, {
      workSchedule: { weeklyHours: 40, entry: '08:00', exit: '17:00', toleranceMinutes: 10 },
      totals: [],
      monthlySummary: { workloadLimit: '00:00', workloadDone: '00:00', pendingTime: '00:00', excessTime: '00:00', delayTime: '00:00', absences: 0, incompleteDays: 0 },
    }));
    await portal.route('**/api/folha/meus-holerites', (route) => json(route, [HOLERITE_PORTAL]));
    await entrar(portal, 'caio@alfa.exemplo.invalid', SENHA, /\/meu-painel$/);
    await esperarTela(portal);
    await portal.clock.pauseAt(new Date('2026-10-10T12:00:00.000Z'));
    await capturarTela(portal, 'colaborador-ponto', largura);

    await portal.clock.resume();
    await portal.goto('/meu-painel/holerites');
    await esperarTela(portal);
    await capturarTela(portal, 'colaborador-holerites', largura);
    await portal.getByRole('button', { name: /Visualizar holerite de/ }).click();
    await expect(portal.getByRole('dialog', { name: 'Detalhes do Holerite' })).toBeVisible();
    await capturarTela(portal, 'colaborador-holerite', largura);
    await portalContext.close();
  });
}
