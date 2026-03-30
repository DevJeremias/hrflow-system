import React from "react";
import { useNavigate } from "react-router-dom"; // traz o hook
import "./Hero.css";
import heroImage from "../../assets/hero_imagem.avif";

export default function Hero() {
  const navigate = useNavigate(); // inicia o hook

  return (
    <section className="hero-section">
      <div className="hero-content">
        <div className="hero-badge">
          <span className="badge-icon">✨</span>
          Revolucione sua Gestão de Pessoas
        </div>

        <h1 className="hero-title">
          O futuro do RH <br />
          <span className="text-highlight">está aqui</span>
        </h1>

        <p className="hero-subtitle">
          Simplifique processos, engaje talentos e transforme dados em decisões
          estratégicas com a plataforma de RH mais completa do mercado.
        </p>

        <div className="hero-buttons">
          {/* botao principal agora aponta pro login */}
          <button className="btn-primary hero-btn" onClick={() => navigate('/login')}>
            Começar Gratuitamente <span>&rarr;</span>
          </button>
          
          <button className="btn-demo">
            <span className="play-icon">▶</span> Ver Demo
          </button>
        </div>

        <div className="hero-stats">
          <div className="stat-item">
            <span className="stat-number">10k+</span>
            <span className="stat-label">Empresas</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">500k+</span>
            <span className="stat-label">Usuários</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">98%</span>
            <span className="stat-label">Satisfação</span>
          </div>
        </div>
      </div>

      <div className="hero-image-composition">
        <div className="hero-image-wrapper">
          <img
            src={heroImage}
            alt="Demonstração do Sistema RH"
            className="hero-img-element"
          />

          <div className="floating-card productivity-card">
            <div className="card-icon check-icon">✓</div>
            <div className="card-text">
              <strong>+45%</strong>
              <span>Produtividade</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}