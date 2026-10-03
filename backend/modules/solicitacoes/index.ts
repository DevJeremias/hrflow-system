// Superfície pública do módulo: o que o resto da aplicação pode importar.
export { solicitacoesRoutes } from './solicitacoes.routes.ts';
// O perfil recebe os mesmos campos (PUT /api/perfil/meus-dados) e cria o pedido quando eles mudam.
export { camposDoPedido, CAMPOS_DO_PEDIDO, CAMPOS_DO_CADASTRO } from './solicitacoes.schemas.ts';
export type { PedidoDeAlteracao, CampoDoPedido } from './solicitacoes.schemas.ts';
export { criarSolicitacao, camposAlterados, exigirSenhaAtual } from './solicitacoes.service.ts';
export type { SolicitacaoDeAlteracao } from './solicitacoes.service.ts';
export { ErroDeSolicitacao } from './solicitacoes.erros.ts';
