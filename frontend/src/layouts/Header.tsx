import React from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ehGestao } from '../utils/sessao';
import Avatar from '../components/ui/Avatar';
import { IconButton } from '../components/ui/Button';

interface HeaderProps {
  onOpenSidebar: () => void;
  menuAberto: boolean;
  menuId: string;
}

const Header: React.FC<HeaderProps> = ({ onOpenSidebar, menuAberto, menuId }) => {
  const { user } = useAuth();

  const ambienteLabel = ehGestao(user?.role) ? 'Ambiente administrativo' : 'Portal do colaborador';
  const primeiroNome = user?.nome ? user.nome.split(' ')[0] : 'Usuário';

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface px-4 md:px-8">
      <div className="flex items-center gap-4">
        <IconButton
          label="Abrir menu"
          onClick={onOpenSidebar}
          aria-expanded={menuAberto}
          aria-controls={menuId}
          className="-ml-2 lg:hidden"
        >
          <Menu size={24} aria-hidden="true" />
        </IconButton>
        <p className="hidden text-sm font-semibold uppercase tracking-wider text-ink-muted lg:block">{ambienteLabel}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-ink">{primeiroNome}</p>
          <p className="text-xs text-ink-muted">{user?.role}</p>
        </div>
        <Avatar name={user?.nome ?? 'Usuário'} src={user?.avatar} />
      </div>
    </header>
  );
};

export default Header;
