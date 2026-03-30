import React from 'react';
import { Menu, X, Search, Bell, LogOut } from 'lucide-react'; // importei o LogOut
import { useNavigate } from 'react-router-dom'; // importei o hook de navegação
import './Header.css';

const Header = ({ isOpen, toggleSidebar }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // 1. apaga o token do navegador
    localStorage.removeItem('token');
    
    // 2. chuta o usuário pra tela de login
    navigate('/login');
  };

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
          
          {/* Botão de sair com um estilo inline rapidinho pra ficar vermelho e alinhado */}
          <button 
            onClick={handleLogout} 
            title="Sair do sistema"
            style={{ 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer', 
              marginLeft: '15px', 
              color: '#ef4444', 
              display: 'flex', 
              alignItems: 'center' 
            }}
          >
            <LogOut size={22} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;