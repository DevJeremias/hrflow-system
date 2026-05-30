import React from 'react';
import { Building2, Pencil, Trash2, Users } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  sigla: string;
  description: string;
  collaborators: number;
  active: number;
  manager: string;
  rolesCount: number;
}

interface Props {
  department: Department;
  onEdit: () => void;
}

const DepartmentCard: React.FC<Props> = ({ department, onEdit }) => {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-primary flex items-center justify-center shadow-inner">
            <Building2 size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 leading-tight">{department.name}</h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
              {department.sigla}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-2 text-slate-400 hover:text-primary hover:bg-indigo-50 rounded-xl transition-all">
            <Pencil size={18} />
          </button>
          <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6 line-clamp-2 h-10">
        {department.description}
      </p>

      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl mb-6">
        <div className="text-center border-r border-slate-200">
          <span className="block text-xl font-black text-slate-900">{department.collaborators}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Total</span>
        </div>
        <div className="text-center">
          <span className="block text-xl font-black text-emerald-500">{department.active}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Ativos</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shadow-md">
            {getInitials(department.manager)}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Gestor</span>
            <span className="text-xs font-bold text-slate-700">{department.manager}</span>
          </div>
        </div>
        <span className="text-xs font-bold text-primary bg-indigo-50 px-3 py-1 rounded-lg">
          {department.rolesCount} cargos
        </span>
      </div>
    </div>
  );
};

export default DepartmentCard;