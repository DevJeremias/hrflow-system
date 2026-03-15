import React, { useState } from 'react';
import './AdminLayout.css'; // Importando o CSS aqui
import { LayoutDashboard, Users, Calendar, Menu, X, Search, Bell } from 'lucide-react';

const NavPage = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="admin-container">
      {/* Sidebar com lógica de classe dinâmica */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">Sistema RH</div>
        <nav className="nav-links">
           <a href="#" className="nav-item active"><LayoutDashboard size={20} /> Dashboard</a>
           <a href="#" className="nav-item"><Users size={20} /> Colaboradores</a>
           {/* Sem itens de Ponto/Gestão aqui */}
        </nav>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header className="navbar">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="mobile-toggle">
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
          
          <div className="search-container">
            <input type="text" className="search-input" placeholder="Pesquisar..." />
          </div>

          <div className="user-section">
             {/* Ícone de notificações e Perfil */}
          </div>
        </header>

        <main className="main-content">
          {children}
        </main>
      </div>

      {isSidebarOpen && <div className="overlay" onClick={() => setIsSidebarOpen(false)}></div>}
    </div>
  );
};

export default NavPage;