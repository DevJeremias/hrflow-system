import React from 'react';
import { Pencil, Trash2, Briefcase, Users } from 'lucide-react';
import { Role } from '../../services/departmentsRolesService';

interface Props {
  roles: Role[];
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}

const RolesTable: React.FC<Props> = ({ roles, onEdit, onDelete }) => {
  const getLevelClass = (level: string) => {
    const classes: any = {
      'Júnior': 'bg-blue-50 text-blue-600',
      'Pleno': 'bg-purple-50 text-purple-600',
      'Sênior': 'bg-indigo-50 text-indigo-600',
      'Gestão': 'bg-rose-50 text-rose-600',
      'Coordenação': 'bg-amber-50 text-amber-600',
    };
    return classes[level] || 'bg-slate-50 text-slate-600';
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 border-b border-slate-100">
            <th className="py-5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cargo</th>
            <th className="py-5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Departamento</th>
            <th className="py-5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Nível</th>
            <th className="py-5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Salário Base</th>
            <th className="py-5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ocupantes</th>
            <th className="py-5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {roles.map(role => (
            <tr key={role.id} className="hover:bg-slate-50/50 transition-colors group">
              <td className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition-all">
                    <Briefcase size={16} />
                  </div>
                  <span className="font-bold text-slate-700">{role.title}</span>
                </div>
              </td>
              <td className="py-4 px-6 text-sm font-semibold text-slate-500">{role.department}</td>
              <td className="py-4 px-6">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${getLevelClass(role.level)}`}>
                  {role.level}
                </span>
              </td>
              <td className="py-4 px-6 font-bold text-slate-900">
                {role.salary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              <td className="py-4 px-6">
                <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                  <Users size={16} className="text-slate-300" /> {role.occupants}
                </div>
              </td>
              <td className="py-4 px-6 text-right">
                <div className="flex justify-end gap-2">
                  <button onClick={() => onEdit(role)} className="p-2 text-slate-400 hover:text-primary hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-100 transition-all">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => onDelete(role)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-100 transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RolesTable;