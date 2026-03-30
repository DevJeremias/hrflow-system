import React from "react";
// tirei o useNavigate daqui porque a gente não vai mais redirecionar a tela
import "./Contact.css";

export default function Contact() {
  const formBenefits = [
    "Sistema dedicado para facilitar o RH e DP",
    "Fácil de usar, simples e intuitiva",
    "Aplicável para CLTs, PJs, Autônomos e outros",
    "Campos e processos totalmente customizáveis",
  ];

  const handleSubmit = (e) => {
    e.preventDefault(); 
    // simula o envio dos dados pro backend e avisa o cliente
    alert("Solicitação enviada com sucesso! Nossa equipe entrará em contato em breve.");
    
    // limpa os campos do formulário
    e.target.reset();
  };

  return (
    <section className="contact-section" id="contato">
      <div className="contact-info">
        <h2 className="contact-title">Agende uma demonstração</h2>
        <p className="contact-description">
          Descubra tudo que o nosso Sistema RH oferece para simplificar e
          automatizar os processos da sua empresa. Fale com nosso time e agende
          uma demonstração gratuita!
        </p>

        <ul className="contact-benefits-list">
          {formBenefits.map((item, index) => (
            <li key={index} className="contact-benefit-item">
              <span className="contact-check-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="contact-form-wrapper">
        <form className="demo-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nome">
              Nome <span>*</span>
            </label>
            <input
              type="text"
              id="nome"
              placeholder="Seu nome completo"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              E-mail Corporativo <span>*</span>
            </label>
            <input
              type="email"
              id="email"
              placeholder="email@suaempresa.com.br"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="celular">
              Celular / WhatsApp <span>*</span>
            </label>
            <input
              type="tel"
              id="celular"
              placeholder="(00) 00000-0000"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="empresa">
              Nome da Empresa <span>*</span>
            </label>
            <input
              type="text"
              id="empresa"
              placeholder="Sua empresa"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="tamanho">
              Quantidade de Colaboradores <span>*</span>
            </label>
            <div className="custom-select-wrapper">
              <select id="tamanho" required defaultValue="">
                <option value="" disabled>
                  Selecione uma opção
                </option>
                <option value="1-20">Menos de 20 colaboradores</option>
                <option value="21-50">De 21 a 50 colaboradores</option>
                <option value="51-200">De 51 a 200 colaboradores</option>
                <option value="201+">Mais de 200 colaboradores</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn-primary submit-btn">
            Solicitar Demonstração
          </button>

          <p className="form-disclaimer">
            Prometemos não enviar spam. Seus dados estão seguros conosco.
          </p>
        </form>
      </div>
    </section>
  );
}