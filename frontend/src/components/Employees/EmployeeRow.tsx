import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { Employee } from '../../services/employeeService';

interface Props {
  employee: Employee;
  onEdit: (employee: Employee) => void;
  onDelete: (id: string) => void;
}

const EmployeeRow: React.FC<Props> = ({ employee, onEdit, onDelete }) => {
  const statusColors = {
    Ativo: 'bg-emerald-100 text-emerald-700',
    Inativo: 'bg-slate-100 text-slate-600',
    Férias: 'bg-amber-100 text-amber-700',
  };

  const corStatus = statusColors[employee.status] || 'bg-slate-100 text-slate-600';

  return (
    <tr className="group hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
      <td className="py-4 px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm overflow-hidden">
            {employee.avatar ? (
              <img src={employee.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              employee.nomeCompleto?.charAt(0) || 'U'
            )}
          </div>
          <div>
            <p className="font-bold text-slate-900">{employee.nomeCompleto}</p>
            <p className="text-xs text-slate-500">{employee.emailPessoal}</p>
          </div>
        </div>
      </td>
      <td className="py-4 px-6 text-sm font-medium text-slate-700">{employee.cargo}</td>
      <td className="py-4 px-6 text-sm text-slate-500">{employee.departamento}</td>
      <td className="py-4 px-6">
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${corStatus}`}>
          {employee.status || 'Ativo'}
        </span>
      </td>
      <td className="py-4 px-6 text-right">
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => onEdit(employee)}
            className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
            title="Editar Colaborador"
          >
            <Edit2 size={18} />
          </button>
          <button 
            onClick={() => onDelete(employee.id)}
            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
            title="Excluir Colaborador"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default EmployeeRow;