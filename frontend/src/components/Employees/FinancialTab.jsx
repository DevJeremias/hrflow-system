import React from 'react';

const FinancialTab = ({ formData, handleChange }) => {
  return (
    <div className="tab-content">
      
      <div className="form-group-row">
        <div className="form-group">
          <label>Banco *</label>
          <input 
            type="text" 
            name="banco" 
            value={formData.banco} 
            onChange={handleChange} 
            required 
            placeholder="Ex: Banco do Brasil" 
          />
        </div>
        <div className="form-group">
          <label>Agência *</label>
          <input 
            type="text" 
            name="agencia" 
            value={formData.agencia} 
            onChange={handleChange} 
            required 
            placeholder="1234-5" 
          />
        </div>
      </div>

      <div className="form-group-row">
        <div className="form-group">
          <label>Conta *</label>
          <input 
            type="text" 
            name="conta" 
            value={formData.conta} 
            onChange={handleChange} 
            required 
            placeholder="12345-6" 
          />
        </div>
        <div className="form-group">
          <label>Tipo de Conta *</label>
          <select 
            name="tipoConta" 
            value={formData.tipoConta} 
            onChange={handleChange} 
            required
          >
            <option value="" disabled>Selecione</option>
            <option value="Corrente">Conta Corrente</option>
            <option value="Poupanca">Conta Poupança</option>
            <option value="Salario">Conta Salário</option>
          </select>
        </div>
      </div>

    </div>
  );
};

export default FinancialTab;