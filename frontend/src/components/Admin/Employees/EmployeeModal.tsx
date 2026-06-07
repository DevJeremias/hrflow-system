import React, { useState, useEffect } from 'react';
import { X, User, Briefcase, CreditCard, Lock } from 'lucide-react';
import { Employee } from '../../../services/employeeService';
import { getRoles, getDepartments } from '../../../services/departmentsRolesService'
import PersonalTab from './PersonalTab';
import WorkTab from './WorkTab';
import FinancialTab from './FinancialTab';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Employee>) => void;
  employeeToEdit?: Employee | null;
}

// Alteramos senhaAcesso para senha para alinhar com o Backend
const initialState = {
  nomeCompleto: '', emailPessoal: '', telefone: '', cpf: '', dataNascimento: '', enderecoCompleto: '', senha: '',
  matricula: '', cargo: '', nivel: '', departamento: '', dataAdmissao: '', tipoContrato: 'CLT', salarioBase: '', status: 'Ativo',
  banco: '', agencia: '', conta: '', tipoConta: '',
  cargoEarnings: [], cargoDeductions: []
};

const EmployeeModal: React.FC<Props> = ({ isOpen, onClose, onSave, employeeToEdit }) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'work' | 'financial'>('personal');
  const [formData, setFormData] = useState<any>(initialState);
  
  const [cargosList, setCargosList] = useState<any[]>([]);
  const [departamentosList, setDepartamentosList] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      getRoles().then(setCargosList).catch(console.error);
      getDepartments().then(setDepartamentosList).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (employeeToEdit) setFormData({ ...initialState, ...employeeToEdit });
    else setFormData(initialState);
    setActiveTab('personal');
  }, [employeeToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let updatedData = { ...formData, [name]: value };

    if (name === 'cargo') {
      const cargoSelecionado = cargosList.find(c => c.title === value);
      if (cargoSelecionado) {
        updatedData = {
          ...updatedData,
          salarioBase: cargoSelecionado.salary.toString(),
          departamento: cargoSelecionado.department,
          nivel: cargoSelecionado.level || '', 
          cargoEarnings: cargoSelecionado.earnings || [],
          cargoDeductions: cargoSelecionado.deductions || []
        };
      }
    }
    setFormData(updatedData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { cargoEarnings, cargoDeductions, ...dadosLimpos } = formData;
    onSave(dadosLimpos);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {employeeToEdit ? 'Editar Perfil' : 'Novo Colaborador'}
            </h2>
            <p className="text-slate-500 font-medium mt-1">Gestão de dados e contrato de trabalho.</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="flex px-10 gap-8 border-b border-slate-100">
          {[
            { id: 'personal', label: 'Pessoal', icon: <User size={18}/> },
            { id: 'work', label: 'Contrato', icon: <Briefcase size={18}/> },
            { id: 'financial', label: 'Financeiro', icon: <CreditCard size={18}/> }
          ].map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-5 border-b-4 font-black text-xs uppercase tracking-widest transition-all ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {activeTab === 'personal' && <PersonalTab formData={formData} handleChange={handleChange} />}
          
          {activeTab === 'work' && (
            <WorkTab 
              formData={formData} 
              handleChange={handleChange} 
              cargos={cargosList} 
              departamentos={departamentosList} 
            />
          )}
          
          {activeTab === 'financial' && <FinancialTab formData={formData} handleChange={handleChange} />}

          {/* INJEÇÃO DE SEGURANÇA: Senha provisória apenas na criação e na aba Pessoal */}
          {!employeeToEdit && activeTab === 'personal' && (
            <div className="mt-8 p-6 bg-indigo-50 border border-indigo-100 rounded-2xl animate-in fade-in">
              <label className="text-[10px] font-black text-indigo-800 uppercase tracking-widest flex items-center gap-2 mb-2">
                <Lock size={14} /> Senha de Acesso Provisória *
              </label>
              <input
                required
                type="text"
                name="senha"
                placeholder="Ex: Mudar123"
                value={formData.senha || ''}
                onChange={handleChange}
                className="w-full p-4 bg-white border border-indigo-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-indigo-900 transition-all"
              />
              <p className="text-[10px] text-indigo-600 mt-2 font-bold">Esta credencial garantirá o acesso inicial do colaborador à plataforma.</p>
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-slate-100 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all">
              Cancelar
            </button>
            <button type="submit" className="flex-[2] py-4 bg-slate-900 hover:bg-primary text-white font-black rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-95">
              {employeeToEdit ? 'Guardar Alterações' : 'Confirmar Cadastro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeModal;