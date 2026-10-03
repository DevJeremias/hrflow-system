// Superfície pública do módulo: o que o resto da aplicação pode importar.
export { pontoRoutes } from './ponto.routes.ts';
// Relógio e dia de Belém, para quem precisa de "hoje" igual ao do ponto.
export { relogio } from './ponto.service.ts';
export { diaLocal, limitesDoDia, limitesDoMes } from './ponto.fuso.ts';
// A apuração do mês, para quem precisa do que o ponto diz de cada dia (a folha: faltas e horas extras).
export { apurarDiasDoMes } from './ponto.service.ts';
export type { JornadaParaApurar } from './ponto.service.ts';
export { ehDomingo } from './ponto.regras.ts';
export type { DecisaoDaJustificativa, DiaApurado, TipoRegistro } from './ponto.regras.ts';
