import { ehAdministrador, ehGestao, temAreaPessoal } from './sessao.ts';
import type { User } from './sessao.ts';

export type IconeDoMenu = 'dashboard' | 'colaboradores' | 'estrutura' | 'folha' | 'empresa' | 'ponto' | 'gestaoPonto' | 'holerite' | 'solicitacoes' | 'usuarios' | 'aprovacoes' | 'auditoria' | 'perfil';

export interface ItemDoMenu {
  path: string;
  label: string;
  icone: IconeDoMenu;
}

export interface SecaoDoMenu {
  titulo: string;
  itens: ItemDoMenu[];
}

// O menu de cada perfil (docs/permissoes.md, seção Menu). `solicitacoes` liga o item quando houver backend.
export const menuDoUsuario = (user: Pick<User, 'role' | 'funcionarioId'>, { solicitacoes = false } = {}): SecaoDoMenu[] => {
  const secoes: SecaoDoMenu[] = [];

  if (ehGestao(user.role)) {
    secoes.push({
      titulo: 'Gestão',
      itens: [
        { path: '/admin', label: 'Dashboard', icone: 'dashboard' },
        { path: '/admin/colaboradores', label: 'Colaboradores', icone: 'colaboradores' },
        { path: '/admin/aprovacoes', label: 'Aprovações', icone: 'aprovacoes' },
        ...(ehAdministrador(user.role) ? [{ path: '/admin/estrutura', label: 'Depto & Cargos', icone: 'estrutura' as const }] : []),
        { path: '/admin/folha', label: 'Folha de Pagamento', icone: 'folha' },
        { path: '/admin/empresa', label: 'Empresa', icone: 'empresa' },
        { path: '/admin/gestao-ponto', label: 'Gestão de Ponto', icone: 'gestaoPonto' },
        ...(ehAdministrador(user.role) ? [{ path: '/admin/usuarios', label: 'Usuários', icone: 'usuarios' as const }] : []),
        { path: '/admin/auditoria', label: 'Auditoria', icone: 'auditoria' },
      ],
    });
  }

  const pessoal: ItemDoMenu[] = [];
  if (temAreaPessoal(user)) {
    pessoal.push(
      { path: '/meu-painel', label: 'Meu ponto', icone: 'ponto' },
      { path: '/meu-painel/holerites', label: 'Meu holerite', icone: 'holerite' },
    );
    if (solicitacoes) pessoal.push({ path: '/meu-painel/solicitacoes', label: 'Minhas Solicitações', icone: 'solicitacoes' });
  }
  // O Colaborador tem os dados na área pessoal; quem gere tem o perfil dentro da área administrativa.
  pessoal.push(ehGestao(user.role)
    ? { path: '/admin/perfil', label: 'Meu Perfil', icone: 'perfil' }
    : { path: '/meu-painel/perfil', label: 'Meus Dados', icone: 'perfil' });

  secoes.push({ titulo: ehGestao(user.role) ? 'Minha área' : 'Menu Principal', itens: pessoal });
  return secoes;
};
