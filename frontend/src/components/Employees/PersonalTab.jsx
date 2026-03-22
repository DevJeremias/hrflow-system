import React from 'react';

const PersonalTab = ({ formData, handleChange }) => {
  return (
    <div className="tab-content">
      
      <div className="form-group-row">
        <div className="form-group">
          <label>Nome Completo *</label>
          <input 
            type="text" 
            name="nomeCompleto" 
            value={formData.nomeCompleto} 
            onChange={handleChange} 
            required 
            placeholder="João da Silva" 
          />
        </div>
        <div className="form-group">
          <label>E-mail Pessoal *</label>
          <input 
            type="email" 
            name="emailPessoal" 
            value={formData.emailPessoal} 
            onChange={handleChange} 
            required 
            placeholder="joao@email.com" 
          />
        </div>
      </div>

      <div className="form-group-row">
        <div className="form-group">
          <label>Telefone</label>
          <input 
            type="tel" 
            name="telefone" 
            value={formData.telefone} 
            onChange={handleChange} 
            placeholder="(11) 98765-4321" 
          />
        </div>
        <div className="form-group">
          <label>CPF *</label>
          <input 
            type="text" 
            name="cpf" 
            value={formData.cpf} 
            onChange={handleChange} 
            required 
            placeholder="123.456.789-00" 
          />
        </div>
      </div>

      <div className="form-group-row">
        <div className="form-group">
          <label>Data de Nascimento *</label>
          <input 
            type="date" 
            name="dataNascimento" 
            value={formData.dataNascimento} 
            onChange={handleChange} 
            required 
          />
        </div>

        <div className="form-group placeholder"></div>
      </div>

      <div className="form-group-full">
        <div className="form-group">
          <label>Endereço Completo</label>
          <input 
            type="text" 
            name="enderecoCompleto" 
            value={formData.enderecoCompleto} 
            onChange={handleChange} 
            placeholder="Rua, número, bairro, cidade - UF" 
          />
        </div>
      </div>

      <div className="form-group-full">
        <div className="form-group">
          <label>Senha de Acesso *</label>
          <input 
            type="password" 
            name="senhaAcesso" 
            value={formData.senhaAcesso} 
            onChange={handleChange} 
            required 
            placeholder="........" 
          />
        </div>
      </div>

    </div>
  );
};

export default PersonalTab;