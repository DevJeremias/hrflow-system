import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { getStandardItems } from '../../services/departmentsRolesService';

// ==========================================
// SUBCOMPONENTE: FORMULÁRIO DE DEPARTAMENTO
// ==========================================
const DepartmentForm: React.FC<{ item?: any }> = ({ item }) => (
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
  item?: any;
  departments: any[];
  earnings: any[];
  setEarnings: (val: any[]) => void;
  deductions: any[];
  setDeductions: (val: any[]) => void;
  dictionary: any;
}

const RoleForm: React.FC<RoleFormProps> = ({ item, departments, earnings, setEarnings, deductions, setDeductions, dictionary }) => {
  const handleAddItem = (setter: any, list: any[]) => setter([...list, { description: '', valueType: 'fixed', value: '' }]);
  const handleRemoveItem = (setter: any, list: any[], idx: number) => setter(list.filter((_: any, i: number) => i !== idx));
  const handleUpdate = (setter: any, list: any[], idx: number, field: string, val: string) => {
    const newList = [...list];
    newList[idx][field] = val;
    setter(newList);
  };

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
            {departments.map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
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
          <input name="salary" type="number" required defaultValue={item?.salary} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none font-bold" placeholder="0.00" />
        </div>
      </div>

      {[
        { title: 'Proventos Padrão', list: earnings, setter: setEarnings, key: 'earnings', color: 'emerald' },
        { title: 'Descontos Padrão', list: deductions, setter: setDeductions, key: 'deductions', color: 'rose' }
      ].map(section => (
        <div key={section.key} className={`p-6 rounded-[2rem] border border-${section.color}-100 bg-${section.color}-50/30 space-y-4`}>
          <div className="flex justify-between items-center px-1">
            <h4 className={`font-black text-sm text-${section.color}-700 uppercase tracking-wider`}>{section.title}</h4>
            <button type="button" onClick={() => handleAddItem(section.setter, section.list)} className={`flex items-center gap-1 text-xs font-bold text-${section.color}-600 hover:scale-105 transition-transform`}>
              <Plus size={16} /> Adicionar Regra
            </button>
          </div>
          
          {section.list.map((row: any, idx: number) => (
            <div key={idx} className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
              <select value={row.description} onChange={(e) => handleUpdate(section.setter, section.list, idx, 'description', e.target.value)} className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none cursor-pointer">
                <option value="">Selecione...</option>
                {dictionary[section.key]?.map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              
              <select value={row.valueType} onChange={(e) => handleUpdate(section.setter, section.list, idx, 'valueType', e.target.value)} className="w-20 p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold cursor-pointer">
                <option value="fixed">R$</option>
                <option value="percentage">%</option>
              </select>

              <input type="number" value={row.value} onChange={(e) => handleUpdate(section.setter, section.list, idx, 'value', e.target.value)} className="w-24 p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none" placeholder={row.valueType === 'percentage' ? "0.0" : "0.00"} />
              
              <button type="button" onClick={() => handleRemoveItem(section.setter, section.list, idx)} className="p-3 text-slate-300 hover:text-rose-500 transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

// ==========================================
// MODAL PRINCIPAL
// ==========================================
interface Props {
  type: 'department' | 'role';
  item?: any;
  departments: any[];
  onClose: () => void;
  onSave: (data: any) => void;
}

const OrgFormModal: React.FC<Props> = ({ type, item, departments, onClose, onSave }) => {
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

export default OrgFormModal;