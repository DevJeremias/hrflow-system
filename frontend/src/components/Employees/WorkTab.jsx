import React from 'react';

const WorkTab = ({ formData, handleChange }) => {
  return (
    <div className="tab-content">
      
      <div className="form-group-row">
        <div className="form-group">
          <label>Matrícula *</label>
          <input 
            type="text" 
            name="matricula" 
            value={formData.matricula} 
            onChange={handleChange} 
            required 
            placeholder="COL999" 
          />
        </div>
        <div className="form-group">
          <label>Cargo *</label>
          <input 
            type="text" 
            name="cargo" 
            value={formData.cargo} 
            onChange={handleChange} 
            required 
            placeholder="Analista de Sistemas" 
          />
        </div>
      </div>

      <div className="form-group-row">
        <div className="form-group">
          <label>Departamento *</label>
          <select 
            name="departamento" 
            value={formData.departamento} 
            onChange={handleChange} 
            required
          >
            <option value="" disabled>Selecione</option>
            <option value="TI">Tecnologia da Informação</option>
            <option value="RH">Recursos Humanos</option>
            <option value="Financeiro">Financeiro</option>
            <option value="Comercial">Comercial</option>
            <option value="Marketing">Marketing</option>
            <option value="Design">Design</option>
          </select>
        </div>
        <div className="form-group">
          <label>Data de Admissão *</label>
          <input 
            type="date" 
            name="dataAdmissao" 
            value={formData.dataAdmissao} 
            onChange={handleChange} 
            required 
          />
        </div>
      </div>

      <div className="form-group-row">
        <div className="form-group">
          <label>Tipo de Contrato *</label>
          <select 
            name="tipoContrato" 
            value={formData.tipoContrato} 
            onChange={handleChange} 
            required
          >
            <option value="" disabled>Selecione</option>
            <option value="CLT">CLT</option>
            <option value="PJ">PJ</option>
            <option value="Estágio">Estágio</option>
          </select>
        </div>
        <div className="form-group">
          <label>Salário Base *</label>
          <input 
            type="text" 
            name="salarioBase" 
            value={formData.salarioBase} 
            onChange={handleChange} 
            required 
            placeholder="5000.00" 
          />
        </div>
      </div>

    </div>
  );
};

export default WorkTab;