// Superfície pública do módulo: o que o resto da aplicação pode importar.
// O authMiddleware, de shared/, importa auth.sessao.ts direto: este index monta o router, que importa
// o authMiddleware, e passar por aqui fecharia um ciclo.
export { criarRouter as criarAuthRouter } from './auth.routes.ts';
