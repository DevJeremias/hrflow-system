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
  
  // O estado de erros que os seus colegas criaram
  const [errors, setErrors] = useState({});

  // A nossa estrutura que o Banco de Dados precisa (com cargo_id e departamento_id)
  const estadoInicial = {
    nomeCompleto: '', emailPessoal: '', telefone: '', cpf: '', dataNascimento: '', enderecoCompleto: '', senhaAcesso: '',
    matricula: '', cargo_id: '', departamento_id: '', dataAdmissao: '', tipoContrato: '', salarioBase: '',
    banco: '', agencia: '', conta: '', tipoConta: ''
  };

  const [formData, setFormData] = useState(estadoInicial);

  // A nossa lógica que busca os cargos reais no Node.js
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
    setErrors({});
  }, [colaboradorEditando, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Limpa o erro da tela quando o usuário começa a digitar
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  // A validação de formulário excelente dos seus colegas
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
    
    if (!colaboradorEditando && !formData.senhaAcesso?.trim()) {
      formErrors.senhaAcesso = 'Senha de acesso é obrigatória';
    }

    setErrors(formErrors);
    return Object.keys(formErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault(); 
    
    // Só salva no banco se passar na validação
    if (validateForm()) {
      onSave(formData); 
    } else {
      setActiveTab('pessoais'); // Volta pra aba principal se tiver erro
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'pessoais':
        return <TabDadosPessoais formData={formData} handleChange={handleChange} errors={errors} />;
      case 'profissionais':
        // Juntamos as nossas listas com o sistema de erros deles
        return <TabDadosProfissionais formData={formData} handleChange={handleChange} cargos={cargos} departamentos={departamentos} errors={errors} />;
      case 'bancarios':
        return <TabDadosBancarios formData={formData} handleChange={handleChange} errors={errors} />;
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        
        <div className="modal-header">
          <h2>{colaboradorEditando ? 'Editar Colaborador' : 'Cadastrar Novo Colaborador'}</h2>
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