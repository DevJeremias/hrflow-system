import React from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ehGestao } from '../utils/sessao';

interface HeaderProps {
  onOpenSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenSidebar }) => {
  const { user } = useAuth();

  const ambienteLabel = ehGestao(user?.role) ? "Ambiente Administrativo" : "Portal do Colaborador";
  const primeiroNome = user?.nome ? user.nome.split(' ')[0] : 'Utilizador';
  const inicial = user?.nome ? user.nome.charAt(0).toUpperCase() : 'U';

  return (
    <header className="bg-white border-b border-slate-200 h-20 px-4 md:px-8 flex items-center justify-between shrink-0 z-10 sticky top-0">
      
      <div className="flex items-center gap-4">
        <button onClick={onOpenSidebar} className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-primary lg:hidden transition-colors">
          <Menu size={24} />
        </button>
        <div className="hidden lg:block">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{ambienteLabel}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-700">{primeiroNome}</p>
            <p className="text-xs font-medium text-slate-500">{user?.role}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-primary flex items-center justify-center text-white font-bold shadow-md overflow-hidden">
            {user?.avatar ? <img src={user.avatar} alt="Foto" className="w-full h-full object-cover" /> : inicial}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;