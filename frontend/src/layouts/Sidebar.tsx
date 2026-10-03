import React, { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calculator,
  Calendar,
  LogOut,
  X,
  Building2,
  Landmark,
  Clock,
  FileText,
  User as UserIcon,
  Command
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ehGestao } from '../utils/sessao';
import { solicitacoesAtivas } from '../utils/recursos';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Avatar from '../components/ui/Avatar';
import { CONSULTA_DESKTOP, ID_DO_MENU } from './menu';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

// Existe só enquanto a gaveta está aberta no celular: o hook guarda quem tinha o foco ao montar (o botão
// do menu) e o devolve ao desmontar.
const ArmadilhaDeFoco: React.FC<{ raiz: React.RefObject<HTMLElement | null>; onEscape: () => void }> = ({ raiz, onEscape }) => {
  useFocusTrap(raiz, { onEscape });
  return null;
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose = () => {} }) => {
  const location = useLocation();
  const { logout, user } = useAuth();
  const gaveta = useRef<HTMLElement>(null);
  const desktop = useMediaQuery(CONSULTA_DESKTOP, true);
  // Abaixo de lg o menu é uma gaveta: fechada, sai da ordem de Tab e da árvore de acessibilidade.
  const fechadaNoCelular = !desktop && !isOpen;

  const adminMenu = [
    { path: '/admin', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { path: '/admin/colaboradores', icon: <Users size={20} />, label: 'Colaboradores' },
    { path: '/admin/estrutura', icon: <Building2 size={20} />, label: 'Depto & Cargos' },
    { path: '/admin/folha', icon: <Calculator size={20} />, label: 'Folha de Pagamento' },
    { path: '/admin/empresa', icon: <Landmark size={20} />, label: 'Empresa' },
    { path: '/admin/gestao-ponto', icon: <Clock size={20} />, label: 'Gestão de Ponto' },
    { path: '/admin/perfil', icon: <UserIcon size={20} />, label: 'Meu Perfil' },
  ];

  const employeeMenu = [
    { path: '/meu-painel', icon: <Clock size={20} />, label: 'Bater Ponto' },
    { path: '/meu-painel/holerites', icon: <FileText size={20} />, label: 'Meus Holerites' },
    ...(solicitacoesAtivas() ? [{ path: '/meu-painel/solicitacoes', icon: <Calendar size={20} />, label: 'Minhas Solicitações' }] : []),
    { path: '/meu-painel/perfil', icon: <UserIcon size={20} />, label: 'Meus Dados' },
  ];

  const menuItems = ehGestao(user?.role) ? adminMenu : employeeMenu;

  return (
    <>
      {isOpen && !desktop && <div aria-hidden="true" className="fixed inset-0 z-40 bg-ink/60 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      {isOpen && !desktop && <ArmadilhaDeFoco raiz={gaveta} onEscape={onClose} />}

      <aside
        ref={gaveta}
        id={ID_DO_MENU}
        aria-label="Menu lateral"
        inert={fechadaNoCelular}
        data-escuro
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-col bg-surface-inverse text-slate-300 transition-transform duration-300 ease-in-out motion-reduce:transition-none lg:static lg:translate-x-0 ${isOpen ? 'translate-x-0 shadow-modal' : '-translate-x-full'}`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="rounded-control bg-brand p-2 text-white"><Command size={20} /></span>
            <span className="text-xl font-extrabold tracking-tight text-white">HRFlow</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            title="Fechar menu"
            className="flex h-11 w-11 items-center justify-center rounded-control text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Menu principal" className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Menu principal</p>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-4 rounded-control px-4 py-3 text-sm font-semibold transition-colors ${isActive ? 'bg-brand text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-control border border-white/10 bg-white/5 px-4 py-3">
            <Avatar name={user?.nome ?? 'Usuário'} src={user?.avatar} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.nome || 'Carregando...'}</p>
              <p className="truncate text-xs text-slate-400">{user?.role}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="flex w-full items-center justify-center gap-2 rounded-control px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} aria-hidden="true" /><span>Sair do sistema</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
