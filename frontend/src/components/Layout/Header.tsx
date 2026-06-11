import React, { useState } from 'react';
import { Menu, Bell, Search, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../AuthContext';

interface HeaderProps {
  onOpenSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenSidebar }) => {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  // Mantida a versão da branch devi, pois o JSX abaixo exige estas variáveis
  const ambienteLabel = user?.role === 'Administrador' ? "Ambiente Administrativo" : "Portal do Colaborador";
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
        <div className="hidden md:flex items-center relative">
          <Search className="absolute left-4 text-slate-400" size={18} />
          <input type="text" placeholder="Buscar no sistema..." className="pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white transition-all w-64 font-medium text-slate-700" />
        </div>

        <div className="relative">
          <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2.5 rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
            <Bell size={22} />
          </button>
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
              <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-black text-slate-800">Notificações</h3>
                <span className="text-xs font-bold text-slate-400">0 Não lidas</span>
              </div>
              <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300"><CheckCircle2 size={24} /></div>
                <div>
                  <p className="font-bold text-slate-600">Tudo limpo por aqui!</p>
                  <p className="text-xs text-slate-400 font-medium">Você não possui notificações pendentes no momento.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-700 group-hover:text-primary transition-colors">{primeiroNome}</p>
            <p className="text-xs font-medium text-slate-500">{user?.role}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-primary flex items-center justify-center text-white font-bold shadow-md group-hover:shadow-lg transition-all overflow-hidden">
            {user?.avatar ? <img src={user.avatar} alt="Foto" className="w-full h-full object-cover" /> : inicial}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;