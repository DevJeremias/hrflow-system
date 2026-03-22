import React from 'react';
import { Menu, X, Search, Bell } from 'lucide-react';
import './Header.css';

const Header = ({ isOpen, toggleSidebar }) => {
  return (
    <header className="navbar">
      <div className="navbar-left">
        <button onClick={toggleSidebar} className="toggle-btn">
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className="navbar-center">
        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input type="text" className="search-input" placeholder="Pesquisar colaborador..." />
        </div>
      </div>

      <div className="navbar-right">
        <button className="notification-btn">
          <Bell size={20} />
          <span className="badge">4</span>
        </button>
        
        <div className="profile-section">
          <div className="profile-info">
            <span className="profile-name">Administrador</span>
            <span className="profile-role">Gestor de RH</span>
          </div>
          <div className="avatar">AD</div>
        </div>
      </div>
    </header>
  );
};

export default Header;