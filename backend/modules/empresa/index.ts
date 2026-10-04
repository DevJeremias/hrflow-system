// Superfície pública do módulo: o que o resto da aplicação pode importar.
export { empresaRoutes } from './empresa.routes.ts';
export { buscarEmpresa, fusoDaEmpresa } from './empresa.service.ts';
// O cadastro de empresa (modules/auth) valida o CNPJ com a mesma regra dos dados da empresa.
export { normalizarCnpj } from './empresa.regras.ts';
