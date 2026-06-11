import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Calculator,  
  Calendar,
  LogOut,
  X, 
  Building2,
  Clock,     
  FileText,  
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../AuthContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { logout, user } = useAuth();

  // Menus do Administrador
  const adminMenu = [
    { path: '/admin', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { path: '/admin/colaboradores', icon: <Users size={20} />, label: 'Colaboradores' },
    { path: '/admin/estrutura', icon: <Building2 size={20} />, label: 'Depto & Cargos' },
    { path: '/admin/folha', icon: <Calculator size={20} />, label: 'Folha de Pagamento' },
  ];

  // Menus do Colaborador
  const employeeMenu = [
    { path: '/meu-painel', icon: <Clock size={20} />, label: 'Bater Ponto' },
    { path: '/meu-painel/holerites', icon: <FileText size={20} />, label: 'Meus Holerites' },
    { path: '/meu-painel/solicitacoes', icon: <Calendar size={20} />, label: 'Minhas Solicitações' },
    { path: '/meu-painel/perfil', icon: <UserIcon size={20} />, label: 'Meus Dados' },
  ];

  const menuItems = user?.role === 'Administrador' ? adminMenu : employeeMenu;

  return (
    <>      
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden" 
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 w-72 bg-zinc-950 text-slate-300 flex flex-col h-screen transition-transform duration-300 ease-in-out shadow-2xl shrink-0 border-r border-zinc-800/50
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        
        <div className="h-24 flex items-center justify-between px-8 border-b border-zinc-800/50">
          <div className="flex items-center gap-3 cursor-pointer">
            
            <img 
              src="./src/assets/logo.png" 
              alt="Ícone do Sistema" 
              className="h-10 w-auto object-contain shrink-0" 
            />
            
            <span className="text-2xl font-black text-white tracking-tight">
              HR<span className="text-purple-500">flow</span>
            </span>

          </div>
          
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-5 py-8 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="px-3 mb-6 text-xs font-black tracking-widest text-zinc-500 uppercase">
            Menu Principal
          </div>
          
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose} 
                className={`
                  group flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 font-semibold
                  ${isActive 
                    ? 'bg-purple-600/10 text-purple-400 shadow-sm border border-purple-500/20' 
                    : 'hover:bg-white/5 hover:text-white text-zinc-400 border border-transparent'}
                `}
              >
                <div className={`${isActive ? 'text-purple-400' : 'group-hover:text-purple-400'} transition-colors`}>
                  {item.icon}
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-5 border-t border-zinc-800/50 bg-zinc-900/30">
          
          <div className="flex items-center gap-3 px-4 py-3 mb-3 rounded-2xl bg-zinc-900 border border-zinc-800/50 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-purple-600 flex items-center justify-center text-white font-black shadow-inner uppercase shrink-0">
              {user?.nome?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user?.nome || 'Carregando...'}</p>
              <p className="text-[11px] text-green-400 font-bold truncate uppercase tracking-wider mt-0.5">{user?.role || 'Usuário'}</p>
            </div>
          </div>
          
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors font-bold text-sm"
          >
            <LogOut size={18} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;