import React from "react";
import "./Navbar.css"; 

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="logo">
        <span className="logo-icon">RH</span>
        <span className="logo-text">Sistema RH</span>
      </div>

      <div className="nav-actions">
        <button className="btn-login">Entrar</button>
        <button className="btn-primary">Teste Grátis</button>
      </div>
    </nav>
  );
}