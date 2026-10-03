// Superfície pública do módulo: o que o resto da aplicação pode importar.
export { pontoRoutes } from './ponto.routes.ts';
// O relógio que os testes fixam para "agora".
export { relogio } from './ponto.service.ts';
// A apuração do mês, para quem precisa do que o ponto diz de cada dia (a folha: faltas e horas extras; os
// relatórios: absenteísmo).
export { apurarDiasDoMes, apurarMesDaEmpresa } from './ponto.service.ts';
export type { ColaboradorApurado, JornadaParaApurar } from './ponto.service.ts';
export { ehDomingo } from './ponto.regras.ts';
export type { DecisaoDaJustificativa, DiaApurado, TipoRegistro } from './ponto.regras.ts';
