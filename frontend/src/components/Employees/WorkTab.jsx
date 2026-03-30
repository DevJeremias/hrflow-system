import React from 'react';

// Agora recebe cargos, departamentos e a propriedade de erros
const WorkTab = ({ formData, handleChange, cargos = [], departamentos = [], errors = {} }) => {
  return (
    <div className="tab-content">
      
      <div className="form-group-row">
        <div className="form-group">
          <label>Matrícula *</label>
          <input 
            type="text" 
            name="matricula" 
            value={formData.matricula || ''} 
            onChange={handleChange} 
            required 
            placeholder="COL999" 
            className={errors.matricula ? 'input-error' : ''}
          />
        </div>
        
        <div className="form-group">
          <label>Cargo *</label>
          <select 
            name="cargo_id" 
            value={formData.cargo_id || ''} 
            onChange={handleChange} 
            required
            className={errors.cargo_id ? 'input-error' : ''}
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
            className={errors.departamento_id ? 'input-error' : ''}
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
            type="date" 
            name="dataAdmissao" 
            value={formData.dataAdmissao || ''} 
            onChange={handleChange} 
            required 
            className={errors.dataAdmissao ? 'input-error' : ''}
          />
        </div>
      </div>

      <div className="form-group-row">
        <div className="form-group">
          <label>Tipo de Contrato *</label>
          <select 
            name="tipoContrato" 
            value={formData.tipoContrato || ''} 
            onChange={handleChange} 
            required
            className={errors.tipoContrato ? 'input-error' : ''}
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
            value={formData.salarioBase || ''} 
            onChange={handleChange} 
            required 
            placeholder="R$ 0,00"
            className={errors.salarioBase ? 'input-error' : ''}
          />
        </div>
      </div>

    </div>
  );
};

export default WorkTab;