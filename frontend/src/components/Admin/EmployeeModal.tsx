import React, { useState, useEffect, useRef } from 'react';
import { X, User, Briefcase, CreditCard } from 'lucide-react';
import { Employee, EmployeeForm } from '../../services/employeeService';
import { useCargos, useDepartamentos } from '../../queries/estrutura';
import { HttpError } from '../../services/httpClient';
import { PersonalTab, WorkTab, FinancialTab } from './EmployeeModalTabs';
import ErrorAlert from '../ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EmployeeForm) => Promise<void>;
  employeeToEdit?: Employee | null;
}

type Tab = 'personal' | 'work' | 'financial';

const initialState: EmployeeForm = {
  nomeCompleto: '', emailPessoal: '', telefone: '', cpf: '', dataNascimento: '', enderecoCompleto: '', senhaAcesso: '',
  matricula: '', cargo: '', cargoId: '', nivel: '', departamento: '', departamentoId: '', dataAdmissao: '', tipoContrato: 'CLT', salarioBase: '', status: 'Ativo',
  banco: '', agencia: '', conta: '', tipoConta: ''
};

// O formulário só guarda texto: o que a tela de colaboradores sabe do cadastro e não se edita aqui
// (perfil do acesso, se há movimento) fica de fora.
const formFrom = (employee: Employee): EmployeeForm => ({
  ...initialState,
  ...Object.fromEntries(Object.entries(employee).filter(([, value]) => typeof value === 'string' || typeof value === 'number')),
}) as EmployeeForm;

// Campo da API (detalhes[].campo) -> aba e campo do formulário onde o RH corrige o valor.
const CAMPOS_DA_API: Record<string, { tab: Tab; field: string }> = {
  nome: { tab: 'personal', field: 'nomeCompleto' },
  email: { tab: 'personal', field: 'emailPessoal' },
  senha: { tab: 'personal', field: 'senhaAcesso' },
  telefone: { tab: 'personal', field: 'telefone' },
  cpf: { tab: 'personal', field: 'cpf' },
  data_nascimento: { tab: 'personal', field: 'dataNascimento' },
  endereco: { tab: 'personal', field: 'enderecoCompleto' },
  data_admissao: { tab: 'work', field: 'dataAdmissao' },
  data_desligamento: { tab: 'work', field: 'dataDesligamento' },
  motivo_desligamento: { tab: 'work', field: 'motivoDesligamento' },
  cargo_id: { tab: 'work', field: 'cargoId' },
  nivel: { tab: 'work', field: 'nivel' },
  departamento_id: { tab: 'work', field: 'departamentoId' },
  tipo_contrato: { tab: 'work', field: 'tipoContrato' },
  salario_base: { tab: 'work', field: 'salarioBase' },
  banco: { tab: 'financial', field: 'banco' },
  agencia: { tab: 'financial', field: 'agencia' },
  conta: { tab: 'financial', field: 'conta' },
  tipo_conta: { tab: 'financial', field: 'tipoConta' },
};

const campoComErro = (error: unknown) => {
  const detalhes: { campo?: string | null }[] = error instanceof HttpError && Array.isArray(error.data?.detalhes) ? error.data.detalhes : [];
  for (const { campo } of detalhes) {
    if (campo && CAMPOS_DA_API[campo]) return CAMPOS_DA_API[campo];
  }
  return null;
};

const CONFIRMACAO_DESCARTE = 'Há dados digitados que ainda não foram salvos. Deseja descartá-los?';

const EmployeeModal: React.FC<Props> = ({ isOpen, onClose, onSave, employeeToEdit }) => {
  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const [formData, setFormData] = useState<EmployeeForm>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errorTarget, setErrorTarget] = useState<{ field: string } | null>(null);
  // O estado só muda no próximo render: o ref fecha a janela entre dois cliques seguidos.
  const submittingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [initialForm, setInitialForm] = useState<EmployeeForm>(initialState);
  // Campos que vieram do cargo e não foram digitados: só esses podem ser trocados por outro cargo.
  const filledByRole = useRef(new Set<string>());

  // Cargos e departamentos vêm do cache compartilhado com a tela de estrutura: abrir o modal de
  // novo não os busca outra vez.
  const cargos = useCargos({ enabled: isOpen });
  const departamentos = useDepartamentos({ enabled: isOpen });
  const cargosList = cargos.data ?? [];
  const departamentosList = departamentos.data ?? [];
  const listaComErro = cargos.error ?? departamentos.error;
  const listError = listaComErro ? mensagemDeErro(listaComErro, 'Erro ao carregar cargos e departamentos') : null;

  useEffect(() => {
    const initial = employeeToEdit ? formFrom(employeeToEdit) : initialState;
    setInitialForm(initial);
    filledByRole.current.clear();
    submittingRef.current = false;
    setFormData(initial);
    setActiveTab('personal');
    setSubmitting(false);
    setSubmitError(null);
    setErrorTarget(null);
  }, [employeeToEdit, isOpen]);

  // Com o erro na tela, o foco vai ao campo a corrigir (a aba dele já foi aberta no mesmo render).
  useEffect(() => {
    if (errorTarget) formRef.current?.querySelector<HTMLElement>(`[name="${errorTarget.field}"]`)?.focus();
  }, [errorTarget]);

  if (!isOpen) return null;

  const hasUnsavedChanges = JSON.stringify(formData) !== JSON.stringify(initialForm);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updatedData = { ...formData, [name]: value };
    filledByRole.current.delete(name);

    // O cargo sugere departamento, nível e salário, mas só onde o RH ainda não digitou nada:
    // um valor digitado nunca é trocado ao escolher o cargo.
    if (name === 'cargoId') {
      const cargoSelecionado = cargosList.find(c => c.id === value);
      if (cargoSelecionado) {
        const sugestoes: EmployeeForm = {
          departamentoId: cargoSelecionado.departmentId,
          nivel: cargoSelecionado.level ?? '',
          salarioBase: cargoSelecionado.salary?.toString() ?? ''
        };
        for (const [field, suggested] of Object.entries(sugestoes)) {
          if (updatedData[field] && !filledByRole.current.has(field)) continue;
          updatedData[field] = suggested;
          if (suggested) filledByRole.current.add(field);
          else filledByRole.current.delete(field);
        }
      }
    }
    setFormData(updatedData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setErrorTarget(null);
    try {
      await onSave(formData);
    } catch (error) {
      setSubmitError(mensagemDeErro(error, 'Não foi possível salvar o colaborador. Tente novamente.'));
      const alvo = campoComErro(error);
      if (alvo) {
        setActiveTab(alvo.tab);
        setErrorTarget({ field: alvo.field });
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Clicar fora é um gesto acidental fácil: com dados digitados, pede confirmação antes de descartá-los.
  const handleBackdropClick = () => {
    if (submittingRef.current) return;
    if (hasUnsavedChanges && !window.confirm(CONFIRMACAO_DESCARTE)) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div data-testid="employee-modal-backdrop" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={handleBackdropClick} />
      
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        <div className="px-6 sm:px-10 py-6 sm:py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
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

        <div className="flex px-6 sm:px-10 gap-5 sm:gap-8 border-b border-slate-100 overflow-x-auto">
          {[
            { id: 'personal', label: 'Pessoal', icon: <User size={18}/> },
            { id: 'work', label: 'Contrato', icon: <Briefcase size={18}/> },
            { id: 'financial', label: 'Financeiro', icon: <CreditCard size={18}/> }
          ].map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex shrink-0 items-center gap-2 py-5 border-b-4 font-black text-xs uppercase tracking-widest transition-all ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar">
            {listError && <div className="mb-6"><ErrorAlert message={listError} /></div>}
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
          </div>

          <div className="px-6 sm:px-10 py-5 border-t border-slate-100 space-y-4">
            {submitError && <ErrorAlert message={submitError} />}
            <div className="flex gap-4">
              <button type="button" onClick={onClose} disabled={submitting} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all disabled:cursor-not-allowed disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" disabled={submitting} className="flex-[2] py-4 bg-slate-900 hover:bg-primary text-white font-black rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100">
                {submitting ? 'Salvando...' : employeeToEdit ? 'Guardar Alterações' : 'Confirmar Cadastro'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeModal;