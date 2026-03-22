import React, { useState, useEffect } from 'react';
import './EmployeeForm.css';
import TabDadosPessoais from './PersonalTab';
import TabDadosProfissionais from './WorkTab';
import TabDadosBancarios from './FinancialTab';

const EmployeeForm = ({ isOpen, onClose, onSave, colaboradorEditando }) => {
  const [activeTab, setActiveTab] = useState('pessoais');
  const [errors, setErrors] = useState({});
  const estadoInicial = {
    nomeCompleto: '', emailPessoal: '', telefone: '', cpf: '', dataNascimento: '', enderecoCompleto: '', senhaAcesso: '',
    matricula: '', cargo: '', departamento: '', dataAdmissao: '', tipoContrato: '', salarioBase: '',
    banco: '', agencia: '', conta: '', tipoConta: ''
  };

  const [formData, setFormData] = useState(estadoInicial);

  useEffect(() => {
    if (colaboradorEditando) {
      setFormData(colaboradorEditando);
    } else {
      setFormData(estadoInicial);
    }    
    setActiveTab('pessoais');
    setErrors({});
  }, [colaboradorEditando, isOpen]);

  if (!isOpen) return null;
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  const validateForm = () => {
    let formErrors = {};
    
    if (!formData.nomeCompleto.trim()) formErrors.nomeCompleto = 'Nome completo é obrigatório';
    if (!formData.emailPessoal.trim()) {
      formErrors.emailPessoal = 'E-mail pessoal é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.emailPessoal)) {
      formErrors.emailPessoal = 'E-mail inválido';
    }
    if (!formData.cpf.trim()) formErrors.cpf = 'CPF é obrigatório';
    if (!formData.dataNascimento) formErrors.dataNascimento = 'Data de nascimento é obrigatória';
    
    if (!colaboradorEditando && !formData.senhaAcesso.trim()) {
      formErrors.senhaAcesso = 'Senha de acesso é obrigatória';
    }

    setErrors(formErrors);
    
    return Object.keys(formErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault(); 
    
    if (validateForm()) {
      onSave(formData); 
      onClose(); 
    } else {
      setActiveTab('pessoais');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'pessoais':
        return <TabDadosPessoais formData={formData} handleChange={handleChange} errors={errors} />;
      case 'profissionais':
        return <TabDadosProfissionais formData={formData} handleChange={handleChange} errors={errors} />;
      case 'bancarios':
        return <TabDadosBancarios formData={formData} handleChange={handleChange} errors={errors} />;
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        
        <div className="modal-header">
          <h2>{colaboradorEditando ? 'Editar Colaborador' : 'Cadastrar Novo Colaborador'}</h2>
          <button className="btn-close" onClick={onClose} aria-label="Fechar modal">&times;</button>
        </div>

        <div className="modal-tabs">
          <button 
            type="button" 
            className={`tab-button ${activeTab === 'pessoais' ? 'active' : ''}`} 
            onClick={() => setActiveTab('pessoais')}
          >
            Dados Pessoais
          </button>
          <button 
            type="button" 
            className={`tab-button ${activeTab === 'profissionais' ? 'active' : ''}`} 
            onClick={() => setActiveTab('profissionais')}
          >
            Dados Profissionais
          </button>
          <button 
            type="button" 
            className={`tab-button ${activeTab === 'bancarios' ? 'active' : ''}`} 
            onClick={() => setActiveTab('bancarios')}
          >
            Dados Bancários
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          
          <div className="modal-body">
            {renderTabContent()}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-save">
              {colaboradorEditando ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;