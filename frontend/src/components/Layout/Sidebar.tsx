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
import { useAuth } from '../../AuthContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { logout, user } = useAuth();

  const adminMenu = [
    { path: '/admin', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { path: '/admin/colaboradores', icon: <Users size={20} />, label: 'Colaboradores' },
    { path: '/admin/estrutura', icon: <Building2 size={20} />, label: 'Depto & Cargos' },
    { path: '/admin/folha', icon: <Calculator size={20} />, label: 'Folha de Pagamento' },
    { path: '/admin/gestao-ponto', icon: <Clock size={20} />, label: 'Gestão de Ponto' }, // Funcionalidade protegida no merge
  ];

  const employeeMenu = [
    { path: '/meu-painel', icon: <Clock size={20} />, label: 'Bater Ponto' },
    { path: '/meu-painel/holerites', icon: <FileText size={20} />, label: 'Meus Holerites' },
    { path: '/meu-painel/solicitacoes', icon: <Calendar size={20} />, label: 'Minhas Solicitações' },
    { path: '/meu-painel/perfil', icon: <UserIcon size={20} />, label: 'Meus Dados' },
  ];

  const menuItems = user?.role === 'Administrador' ? adminMenu : employeeMenu;
  const inicial = user?.nome ? user.nome.charAt(0).toUpperCase() : 'U';

  return (
    <>      
      {isOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-slate-300 flex flex-col h-screen transition-transform duration-300 ease-in-out shadow-2xl lg:translate-x-0 lg:static lg:inset-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="h-24 flex items-center justify-between px-8 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/20">
              <Command size={20} />
            </div>
            <span className="text-white font-black text-xl tracking-tight">HR<span className="text-indigo-500">Flow</span></span>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <nav className="flex-1 px-5 py-8 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="px-3 mb-4 text-xs font-bold tracking-widest text-slate-500 uppercase">Menu Principal</div>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} onClick={onClose} 
                className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-semibold ${isActive ? 'bg-primary text-white shadow-lg shadow-indigo-500/20' : 'hover:bg-white/5 hover:text-white text-slate-400'}`}>
                {item.icon}<span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-5 border-t border-slate-800/50">
          <div className="flex items-center gap-3 px-4 py-3 mb-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-primary flex items-center justify-center text-white font-bold shadow-inner uppercase overflow-hidden shrink-0">
              {user?.avatar ? <img src={user.avatar} alt="Foto" className="w-full h-full object-cover" /> : inicial}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user?.nome || 'Carregando...'}</p>
              <p className="text-xs text-slate-500 font-medium truncate">{user?.role}</p>
            </div>
          </div>
          
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors font-bold text-sm">
            <LogOut size={18} /><span>Sair do Sistema</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;