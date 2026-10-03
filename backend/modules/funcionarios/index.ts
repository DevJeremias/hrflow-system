// Superfície pública do módulo: o que o resto da aplicação pode importar.
export { funcionariosRoutes } from './funcionarios.routes.ts';
// O ponto restringe o Colaborador ao próprio vínculo.
export { verificarAcessoFuncionario } from './funcionarios.acesso.ts';
// O perfil valida o avatar com a mesma regra do cadastro de colaborador.
export { validarAvatar, TAMANHO_MAXIMO_BYTES } from './funcionarios.avatar.ts';
