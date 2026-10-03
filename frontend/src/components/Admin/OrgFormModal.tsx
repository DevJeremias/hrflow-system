import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';
import ErrorAlert from '../ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import type { Department, DepartmentForm as DepartmentFormData, Role, RoleForm as RoleFormData } from '../../services/departmentsRolesService';

// ==========================================
// SUBCOMPONENTE: FORMULÁRIO DE DEPARTAMENTO
// ==========================================
const DepartmentForm: React.FC<{ item?: Department }> = ({ item }) => (
  <div className="grid grid-cols-1 gap-6 animate-in fade-in duration-300">
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-700 ml-1">Nome do Departamento *</label>
      <input name="name" required defaultValue={item?.name} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium" placeholder="Ex: Engenharia de Software" />
    </div>
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Sigla *</label>
        <input name="sigla" required defaultValue={item?.sigla} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold uppercase" placeholder="TI" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Gestor</label>
        <input name="manager" defaultValue={item?.manager} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium" placeholder="Nome do Gestor" />
      </div>
    </div>
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-700 ml-1">Descrição</label>
      <textarea name="description" rows={3} defaultValue={item?.description} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium resize-none" placeholder="Breve descrição das responsabilidades do setor..." />
    </div>
  </div>
);

// ==========================================
// SUBCOMPONENTE: FORMULÁRIO DE CARGO
// ==========================================
interface RoleFormProps {
  item?: Role;
  departments: Department[];
}

const RoleForm: React.FC<RoleFormProps> = ({ item, departments }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Título do Cargo *</label>
          <input name="title" required defaultValue={item?.title} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none" placeholder="Ex: Analista de Sistemas" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Setor Responsável *</label>
          <select name="department" required defaultValue={item?.department} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none appearance-none cursor-pointer">
            <option value="">Selecione...</option>
            {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Nível Hierárquico</label>
          <select name="level" defaultValue={item?.level || 'Pleno'} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none cursor-pointer">
            <option>Júnior</option><option>Pleno</option><option>Sênior</option><option>Gestão</option><option>Coordenação</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Salário Base (R$) *</label>
          <input name="salary" type="number" required defaultValue={item?.salary ?? undefined} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none font-bold" placeholder="0.00" />
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MODAL PRINCIPAL
// ==========================================
interface Props {
  type: 'department' | 'role';
  item?: Department | Role | null;
  departments: Department[];
  onClose: () => void;
  onSave: (data: DepartmentFormData | RoleFormData) => Promise<void>;
}

const OrgFormModal: React.FC<Props> = ({ type, item, departments, onClose, onSave }) => {
  const isDept = type === 'department';
  
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // O estado só muda no próximo render: o ref fecha a janela entre dois cliques seguidos.
  const submittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingRef.current) return;
    const formData = new FormData(e.currentTarget);
    // Os campos do formulário são `name` dos inputs: o que chega aqui é só texto.
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSave(isDept
        ? { id: item?.id, name: data.name, sigla: data.sigla, description: data.description, manager: data.manager }
        : { id: item?.id, title: data.title, department: data.department, level: data.level, salary: data.salary });
    } catch (error) {
      setSubmitError(mensagemDeErro(error, 'Não foi possível salvar. Tente novamente.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {item ? 'Editar' : 'Novo'} {isDept ? 'Departamento' : 'Cargo'}
            </h2>
            <p className="text-slate-500 text-sm font-medium">Preencha os dados estruturais abaixo.</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          
          {isDept ? (
            <DepartmentForm item={item as Department | undefined} />
          ) : (
            <RoleForm item={item as Role | undefined} departments={departments} />
          )}

          {submitError && <div className="mt-8"><ErrorAlert message={submitError} /></div>}

          <div className="mt-12 pt-8 border-t border-slate-100 flex gap-4">
            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all disabled:cursor-not-allowed disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="flex-[2] py-4 bg-slate-900 hover:bg-primary text-white font-black rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100">
              {submitting ? 'Salvando...' : 'Finalizar Registro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrgFormModal;