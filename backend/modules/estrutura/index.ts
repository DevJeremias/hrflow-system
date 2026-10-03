// Superfície pública do módulo: o que o resto da aplicação pode importar.
export { estruturaRoutes } from './estrutura.routes.ts';
// Conferência de que cargo e departamento pertencem à empresa, para quem recebe esses ids do cliente.
export { cargoDaEmpresa, departamentoDaEmpresa } from './estrutura.repository.ts';
