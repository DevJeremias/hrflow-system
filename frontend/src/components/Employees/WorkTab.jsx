import React from 'react';

// Agora recebe cargos e departamentos como propriedades
const WorkTab = ({ formData, handleChange, cargos = [], departamentos = [] }) => {
  return (
    <div className="tab-content">
      
      <div className="form-group-row">
        <div className="form-group">
          <label>Matrícula *</label>
          <input 
            type="text" name="matricula" value={formData.matricula || ''} onChange={handleChange} required placeholder="COL999" 
          />
        </div>
        
        <div className="form-group">
          <label>Cargo *</label>
          <select 
            name="cargo_id" 
            value={formData.cargo_id || ''} 
            onChange={handleChange} 
            required
          >
            <option value="" disabled>Selecione um Cargo</option>
            {cargos.map(cargo => (
              <option key={cargo.id} value={cargo.id}>{cargo.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group-row">
        <div className="form-group">
          <label>Departamento *</label>
          <select 
            name="departamento_id" 
            value={formData.departamento_id || ''} 
            onChange={handleChange} 
            required
          >
            <option value="" disabled>Selecione um Departamento</option>
            {departamentos.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.nome}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Data de Admissão *</label>
          <input 
            type="date" name="dataAdmissao" value={formData.dataAdmissao || ''} onChange={handleChange} required 
          />
        </div>
      </div>

      <div className="form-group-row">
        <div className="form-group">
          <label>Tipo de Contrato *</label>
          <select name="tipoContrato" value={formData.tipoContrato || ''} onChange={handleChange} required>
            <option value="" disabled>Selecione</option>
            <option value="CLT">CLT</option>
            <option value="PJ">PJ</option>
            <option value="Estágio">Estágio</option>
          </select>
        </div>
        <div className="form-group">
          <label>Salário Base *</label>
          <input 
            type="text" name="salarioBase" value={formData.salarioBase || ''} onChange={handleChange} required placeholder="R$ 0,00"
          />
        </div>
      </div>
    </div>
  );
};

export default WorkTab;