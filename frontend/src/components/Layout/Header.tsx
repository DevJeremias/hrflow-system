import React from 'react';
import { Menu, Bell, Search } from 'lucide-react';
import { useAuth } from '../../AuthContext';

interface HeaderProps {
  onOpenSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenSidebar }) => {
  const { user } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 h-20 px-4 md:px-8 flex items-center justify-between shrink-0 z-10 sticky top-0">
      
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSidebar}
          className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-primary lg:hidden transition-colors"
        >
          <Menu size={24} />
        </button>
        
        <div className="hidden lg:block">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">
            Ambiente Administrativo
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        
        <div className="hidden md:flex items-center relative">
          <Search className="absolute left-4 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar no sistema..."
            className="pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white transition-all w-64 font-medium text-slate-700"
          />
        </div>

        {/* Ícone de Notificações com Alerta */}
        <button className="relative p-2.5 rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
          <Bell size={22} />
          <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
        </button>

        {/* Separador Visual */}
        <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-700 group-hover:text-primary transition-colors">
              {user?.name?.split(' ')[0]} 
            </p>
            <p className="text-xs font-medium text-slate-500">{user?.role}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-primary flex items-center justify-center text-white font-bold shadow-md group-hover:shadow-lg transition-all">
            {user?.name?.charAt(0) || 'U'}
          </div>
        </div>

      </div>
    </header>
  );
};

export default Header;