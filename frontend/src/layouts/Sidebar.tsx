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
  Command
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, isCollapsed }) => {
  const location = useLocation();
  const { logout, user } = useAuth();

  const adminMenu = [
    { path: '/admin', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { path: '/admin/colaboradores', icon: <Users size={20} />, label: 'Colaboradores' },
    { path: '/admin/estrutura', icon: <Building2 size={20} />, label: 'Depto & Cargos' },
    { path: '/admin/folha', icon: <Calculator size={20} />, label: 'Folha Pagamento' },
    { path: '/admin/gestao-ponto', icon: <Clock size={20} />, label: 'Gestão Ponto' },
  ];

  const employeeMenu = [
    { path: '/meu-painel', icon: <Clock size={20} />, label: 'Bater Ponto' },
    { path: '/meu-painel/holerites', icon: <FileText size={20} />, label: 'Holerites' },
    { path: '/meu-painel/solicitacoes', icon: <Calendar size={20} />, label: 'Solicitações' },
    { path: '/meu-painel/perfil', icon: <UserIcon size={20} />, label: 'Meus Dados' },
  ];

  const menuItems = user?.role === 'Administrador' ? adminMenu : employeeMenu;
  const inicial = user?.nome ? user.nome.charAt(0).toUpperCase() : 'U';

  return (
    <>      
      {isOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />}

      <aside className={`fixed inset-y-0 left-0 z-50 bg-secondary text-slate-300 flex flex-col h-screen transition-all duration-300 ease-in-out shadow-2xl lg:static lg:inset-0 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}>
        
        <div className={`h-20 flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-6'} border-b border-slate-800/50`}>
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg text-white shadow-lg shadow-primary/20">
              <Command size={18} />
            </div>
            {!isCollapsed && (
              <span className="text-white font-black text-lg tracking-tight transition-opacity duration-300">
                HR<span className="text-emerald-500">Flow</span>
              </span>
            )}
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
          {!isCollapsed && (
            <div className="px-2 mb-3 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
              Menu Principal
            </div>
          )}
          
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                onClick={onClose} 
                title={item.label}
                className={`flex transition-all font-semibold rounded-xl 
                  ${isCollapsed 
                    ? 'flex-col items-center justify-center p-2 gap-1.5' 
                    : 'flex-row items-center gap-3 px-3 py-2.5'
                  } 
                  ${isActive 
                    ? 'bg-primary text-white shadow-md shadow-primary/20' 
                    : 'hover:bg-white/5 hover:text-white text-slate-400'
                  }`
                }
              >
                <div className="shrink-0">{item.icon}</div>
                
                {!isCollapsed && <span className="text-sm whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`p-3 border-t border-slate-800/50 ${isCollapsed ? 'flex flex-col items-center gap-2' : ''}`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl bg-white/5 border border-white/10">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold shadow-inner uppercase overflow-hidden shrink-0 text-sm">
                {user?.avatar ? <img src={user.avatar} alt="Foto" className="w-full h-full object-cover" /> : inicial}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-white truncate">{user?.nome || 'Carregando...'}</p>
                <p className="text-[10px] text-slate-500 font-medium truncate">{user?.role}</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold shadow-inner uppercase overflow-hidden shrink-0 text-sm mb-1">
              {user?.avatar ? <img src={user.avatar} alt="Foto" className="w-full h-full object-cover" /> : inicial}
            </div>
          )}
          
          <button 
            onClick={logout} 
            title="Sair do Sistema"
            className={`w-full flex transition-colors font-bold rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 
              ${isCollapsed 
                ? 'flex-col items-center justify-center p-2 gap-1' 
                : 'flex-row items-center justify-center gap-2 px-3 py-2'
              }`
            }
          >
            <LogOut size={18} />
            {!isCollapsed && <span className="text-xs">Sair</span>}
          </button>
        </div>
        
      </aside>
    </>
  );
};

export default Sidebar;