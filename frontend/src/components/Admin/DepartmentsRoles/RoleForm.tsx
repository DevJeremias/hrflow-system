import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  item?: any;
  departments: any[];
  earnings: any[];
  setEarnings: (val: any[]) => void;
  deductions: any[];
  setDeductions: (val: any[]) => void;
  dictionary: any;
}

const RoleForm: React.FC<Props> = ({ item, departments, earnings, setEarnings, deductions, setDeductions, dictionary }) => {
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

      {/* LISTAS DINÂMICAS: PROVENTOS E DESCONTOS */}
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
              <select 
                value={row.description} 
                onChange={(e) => handleUpdate(section.setter, section.list, idx, 'description', e.target.value)}
                className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none cursor-pointer"
              >
                <option value="">Selecione...</option>
                {dictionary[section.key]?.map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              
              <select 
                value={row.valueType} 
                onChange={(e) => handleUpdate(section.setter, section.list, idx, 'valueType', e.target.value)}
                className="w-20 p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold cursor-pointer"
              >
                <option value="fixed">R$</option>
                <option value="percentage">%</option>
              </select>

              <input 
                type="number" 
                value={row.value}
                onChange={(e) => handleUpdate(section.setter, section.list, idx, 'value', e.target.value)}
                className="w-24 p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none" 
                placeholder={row.valueType === 'percentage' ? "0.0" : "0.00"}
              />
              
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

export default RoleForm;