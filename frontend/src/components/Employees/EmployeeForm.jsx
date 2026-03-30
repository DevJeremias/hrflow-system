import React, { useState, useEffect } from 'react';
import './EmployeeForm.css';
import TabDadosPessoais from './PersonalTab';
import TabDadosProfissionais from './WorkTab';
import TabDadosBancarios from './FinancialTab';
import { buscarCargos, buscarDepartamentos } from '../../services/colaboradoresService';

const EmployeeForm = ({ isOpen, onClose, onSave, colaboradorEditando }) => {
  const [activeTab, setActiveTab] = useState('pessoais');
  const [cargos, setCargos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);

  // Adicionamos cargo_id e departamento_id ao estado
  const estadoInicial = {
    nomeCompleto: '', emailPessoal: '', telefone: '', cpf: '', dataNascimento: '', enderecoCompleto: '', senhaAcesso: '',
    matricula: '', cargo_id: '', departamento_id: '', dataAdmissao: '', tipoContrato: '', salarioBase: '',
    banco: '', agencia: '', conta: '', tipoConta: ''
  };

  const [formData, setFormData] = useState(estadoInicial);

  // Carrega as listas de opções da base de dados (ou do fallback)
  useEffect(() => {
    const carregarListas = async () => {
      setCargos(await buscarCargos());
      setDepartamentos(await buscarDepartamentos());
    };
    if (isOpen) carregarListas();
  }, [isOpen]);

  useEffect(() => {
    if (colaboradorEditando) {
      setFormData(colaboradorEditando);
    } else {
      setFormData(estadoInicial);
    }    
    setActiveTab('pessoais');
  }, [colaboradorEditando, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'pessoais':
        return <TabDadosPessoais formData={formData} handleChange={handleChange} />;
      case 'profissionais':
        // Passamos as listas para a aba profissional
        return <TabDadosProfissionais formData={formData} handleChange={handleChange} cargos={cargos} departamentos={departamentos} />;
      case 'bancarios':
        return <TabDadosBancarios formData={formData} handleChange={handleChange} />;
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>{colaboradorEditando ? 'Editar Colaborador' : 'Novo Colaborador'}</h2>
          <button className="btn-close" onClick={onClose} aria-label="Fechar modal">&times;</button>
        </div>

        <div className="modal-tabs">
          <button type="button" className={`tab-button ${activeTab === 'pessoais' ? 'active' : ''}`} onClick={() => setActiveTab('pessoais')}>Dados Pessoais</button>
          <button type="button" className={`tab-button ${activeTab === 'profissionais' ? 'active' : ''}`} onClick={() => setActiveTab('profissionais')}>Dados Profissionais</button>
          <button type="button" className={`tab-button ${activeTab === 'bancarios' ? 'active' : ''}`} onClick={() => setActiveTab('bancarios')}>Dados Bancários</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {renderTabContent()}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-save">{colaboradorEditando ? 'Salvar Alterações' : 'Cadastrar Colaborador'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;