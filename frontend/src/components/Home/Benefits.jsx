import React from "react";
import "./Benefits.css";
import mosaicoImage from "../../assets/benefits_imagem.png";

export default function Benefits() {
  const benefitsList = [
    "Reduza o tempo de processos de RH em até 70%",
    "Melhore o engajamento dos colaboradores",
    "Tome decisões baseadas em dados reais",
    "Automatize tarefas repetitivas",
    "Centralize toda a informação em um único lugar",
    "Escale seu RH conforme a empresa cresce",
  ];

  return (
    <section className="benefits-section" id="recursos">
      <div className="benefits-image-wrapper">
        <div className="mosaico-placeholder">
          <img
            src={mosaicoImage}
            alt="Benefícios do Sistema RH"
            className="mosaico-img"
          />
        </div>
      </div>

      <div className="benefits-content">
        <span className="benefits-badge">
          POR QUE ESCOLHER NOSSA PLATAFORMA
        </span>
        <h2 className="benefits-title">
          Transforme Seu RH em um Centro Estratégico
        </h2>
        <p className="benefits-description">
          Mais do que um sistema, somos seu parceiro para construir uma cultura
          organizacional de alto desempenho.
        </p>

        <ul className="benefits-list">
          {benefitsList.map((item, index) => (
            <li key={index} className="benefit-item">
              <span className="check-circle">✓</span>
              {item}
            </li>
          ))}
        </ul>

        <button className="btn-primary benefits-btn">
          Agendar Demonstração
        </button>
      </div>
    </section>
  );
}
