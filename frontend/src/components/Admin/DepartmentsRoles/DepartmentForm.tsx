import React from 'react';

interface Props {
  item?: any;
}

const DepartmentForm: React.FC<Props> = ({ item }) => (
  <div className="grid grid-cols-1 gap-6 animate-in fade-in duration-300">
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-700 ml-1">Nome do Departamento *</label>
      <input 
        name="name" 
        required 
        defaultValue={item?.name} 
        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium" 
        placeholder="Ex: Engenharia de Software" 
      />
    </div>
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Sigla *</label>
        <input 
          name="sigla" 
          required 
          defaultValue={item?.sigla} 
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold uppercase" 
          placeholder="TI" 
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Gestor</label>
        <input 
          name="manager" 
          defaultValue={item?.manager} 
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium" 
          placeholder="Nome do Gestor" 
        />
      </div>
    </div>
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-700 ml-1">Descrição</label>
      <textarea 
        name="description" 
        rows={3} 
        defaultValue={item?.description} 
        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium resize-none" 
        placeholder="Breve descrição das responsabilidades do setor..." 
      />
    </div>
  </div>
);

export default DepartmentForm;