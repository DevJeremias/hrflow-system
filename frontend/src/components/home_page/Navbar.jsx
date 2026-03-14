import React, { useState } from "react";
import "./Navbar.css";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className="navbar">
      <div className="logo">
        <span className="logo-icon">HR</span>
        <span className="logo-text">Sistema RH</span>
      </div>

      <button className="mobile-menu-btn" onClick={toggleMenu}>
        {isOpen ? "✕" : "☰"}
      </button>

      <div className={`nav-content ${isOpen ? "active" : ""}`}>
        <ul className="nav-links">
          <li>
            <a href="#funcionalidades" onClick={toggleMenu}>
              Funcionalidades
            </a>
          </li>
          <li>
            <a href="#precos" onClick={toggleMenu}>
              Preços
            </a>
          </li>
          <li>
            <a href="#recursos" onClick={toggleMenu}>
              Recursos
            </a>
          </li>
          <li>
            <a href="#clientes" onClick={toggleMenu}>
              Clientes
            </a>
          </li>
          <li>
            <a href="#contato" onClick={toggleMenu}>
              Contato
            </a>
          </li>
        </ul>

        <div className="nav-actions">
          <button className="btn-login">Entrar</button>
          <button className="btn-primary">Teste Grátis</button>
        </div>
      </div>
    </nav>
  );
}
