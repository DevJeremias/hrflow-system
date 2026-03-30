import React from "react";
import { useNavigate } from "react-router-dom"; 
import "./Navbar.css"; 

export default function Navbar() {
  const navigate = useNavigate(); 

  return (
    <nav className="navbar">
      <div className="logo">
        <span className="logo-icon">RH</span>
        <span className="logo-text">Sistema RH</span>
      </div>

      <div className="nav-actions">
        {/* Vai para a tela de Login normal */}
        <button className="btn-login" onClick={() => navigate('/login')}>
          Entrar
        </button>
        {/* Agora leva o novo cliente direto para criar a empresa dele! */}
        <button className="btn-primary" onClick={() => navigate('/registro')}>
          Teste Grátis
        </button>
      </div>
    </nav>
  );
}