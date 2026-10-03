// Superfície pública do módulo: o que o resto da aplicação pode importar.
export { pontoRoutes } from './ponto.routes.ts';
// O relógio que os testes fixam para "agora".
export { relogio } from './ponto.service.ts';
// O mês de todos os colaboradores da empresa, apurado dia a dia (relatório de absenteísmo).
export { apurarMesDaEmpresa } from './ponto.service.ts';
export type { ColaboradorApurado } from './ponto.service.ts';
export type { DiaApurado } from './ponto.regras.ts';
