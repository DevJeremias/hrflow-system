// Superfície pública do módulo: o que o resto da aplicação pode importar.
// Os middlewares e schemas de shared/ importam auth.sessao.ts e auth.schemas.ts direto: este index monta o router, que importa o authMiddleware, e passar por
// aqui fecharia um ciclo (e carregaria o segredo JWT em quem só precisa das validações).
export { authRoutes, criarRouter as criarAuthRouter } from './auth.routes.ts';
