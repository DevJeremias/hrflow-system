// Superfície pública do módulo: o que o resto da aplicação pode importar.
export { folhaRoutes } from './folha.routes.ts';
// O que os relatórios leem da folha fechada ou aberta: a mesma conta que a tela da folha mostra.
export { consultarFolha } from './folha.service.ts';
export type { FolhaDaCompetencia, HoleriteDoColaborador } from './folha.service.ts';
export { ErroDeFolha } from './folha.erros.ts';
export { emCentavos, emReais } from './folha.regras.ts';
