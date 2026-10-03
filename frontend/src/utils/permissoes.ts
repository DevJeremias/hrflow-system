// Espelho de backend/shared/utils/permissoes.ts (matriz em docs/permissoes.md). Só decide o que a
// tela mostra: quem recusa de fato é a API, que responde 403.
import type { User } from './sessao.ts';

interface AlvoDoCadastro {
  id: string;
  // Perfil da conta de acesso do cadastro; vazio quando ele não tem conta.
  perfilAcesso?: string | null;
}

// O Administrador alcança qualquer cadastro; o RH, só os de Colaborador que não são o dele.
export const podeGerirCadastro = (user: Pick<User, 'role' | 'funcionarioId'> | null, alvo: AlvoDoCadastro): boolean => {
  if (!user) return false;
  if (user.role === 'Administrador') return true;
  if (user.funcionarioId !== null && String(user.funcionarioId) === alvo.id) return false;
  return alvo.perfilAcesso !== 'RH' && alvo.perfilAcesso !== 'Administrador';
};

export const motivoDeNegacaoDoCadastro = (user: Pick<User, 'role' | 'funcionarioId'> | null, alvo: AlvoDoCadastro): string => {
  if (user && user.funcionarioId !== null && String(user.funcionarioId) === alvo.id) {
    return 'Você não altera o seu próprio cadastro. Peça a um Administrador.';
  }
  return 'Só um Administrador altera o cadastro de quem tem acesso de RH ou Administrador.';
};
