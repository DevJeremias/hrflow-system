import React from "react";
import { useNavigate } from "react-router-dom"; // traz o hook de navegacao
import "./Navbar.css"; 

export default function Navbar() {
  const navigate = useNavigate(); // inicia o hook

  return (
    <nav className="navbar">
      <div className="logo">
        <span className="logo-icon">RH</span>
        <span className="logo-text">Sistema RH</span>
      </div>

      <div className="nav-actions">
        {/* joga o usuario pra tela de login no clique */}
        <button className="btn-login" onClick={() => navigate('/login')}>
          Entrar
        </button>
        <button className="btn-primary" onClick={() => navigate('/login')}>
          Teste Grátis
        </button>
      </div>
    </nav>
  );
}