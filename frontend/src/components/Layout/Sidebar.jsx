import React from 'react';
import { Link, useLocation } from 'react-router-dom'; 
import { LayoutDashboard, Users, Calendar } from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ isOpen }) => {
  const location = useLocation();

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        Sistema RH
      </div>
      <nav className="nav-links">
         
         <Link 
           to="/admin" 
           className={`nav-item ${location.pathname === '/admin' ? 'active' : ''}`}
         >
           <LayoutDashboard size={20} /> Dashboard
         </Link>
         
         <Link 
           to="/admin/colaboradores" 
           className={`nav-item ${location.pathname === '/admin/colaboradores' ? 'active' : ''}`}
         >
           <Users size={20} /> Colaboradores
         </Link>
         
         <Link 
           to="/admin/eventos" 
           className={`nav-item ${location.pathname === '/admin/folhaPagamento' ? 'active' : ''}`}
         >
           <Calendar size={20} /> Folha de Pagamento
         </Link>

      </nav>
    </aside>
  );
};

export default Sidebar;