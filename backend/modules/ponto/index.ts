// Superfície pública do módulo: o que o resto da aplicação pode importar.
export { pontoRoutes } from './ponto.routes.ts';
// Relógio e dia de Belém, para quem precisa de "hoje" igual ao do ponto.
export { relogio } from './ponto.service.ts';
export { diaLocal, limitesDoDia } from './ponto.fuso.ts';
