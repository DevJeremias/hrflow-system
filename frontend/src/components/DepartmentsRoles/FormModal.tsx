import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getStandardItems } from '../../services/departmentsRolesService';
import DepartmentForm from './DepartmentForm';
import RoleForm from './RoleForm';

interface Props {
  type: 'department' | 'role';
  item?: any;
  departments: any[];
  onClose: () => void;
  onSave: (data: any) => void;
}

const FormModal: React.FC<Props> = ({ type, item, departments, onClose, onSave }) => {
  const isDept = type === 'department';
  
  const [earnings, setEarnings] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [dictionary, setDictionary] = useState<any>({ earnings: [], deductions: [] });

  useEffect(() => {
    getStandardItems().then(setDictionary);

    if (!isDept && item) {
      setEarnings(item.earnings || []);
      setDeductions(item.deductions || []);
    }
  }, [item, isDept]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    if (!isDept) {
      onSave({ ...data, earnings, deductions, id: item?.id });
    } else {
      onSave({ ...data, id: item?.id });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        {/* Cabeçalho do Modal */}
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

        {/* Corpo do Modal (Scrollável) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          
          {/* Chama o formulário correto baseado no tipo selecionado */}
          {isDept ? (
            <DepartmentForm item={item} />
          ) : (
            <RoleForm 
              item={item} 
              departments={departments} 
              earnings={earnings} 
              setEarnings={setEarnings} 
              deductions={deductions} 
              setDeductions={setDeductions}
              dictionary={dictionary}
            />
          )}

          {/* Botões de Ação */}
          <div className="mt-12 pt-8 border-t border-slate-100 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all">
              Cancelar
            </button>
            <button type="submit" className="flex-[2] py-4 bg-slate-900 hover:bg-primary text-white font-black rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-95">
              Finalizar Registro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormModal;