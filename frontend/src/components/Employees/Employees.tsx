import React, { useState, useEffect } from 'react';
import {  Plus, Search, Loader2 } from 'lucide-react';
import { Employee, employeeService } from '../../services/employeeService';
import EmployeeRow from './EmployeeRow';
import EmployeeModal from './EmployeeModal';

const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    setLoading(true);
    const data = await employeeService.getAll();
    setEmployees(data);
    setLoading(false);
  };

  const handleSave = async (employeeData: Partial<Employee>) => {
    try {
      await employeeService.save(employeeData);
      await loadEmployees(); 
      setIsModalOpen(false);
    } catch (error) {
      alert("Erro ao guardar colaborador.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem a certeza que deseja excluir este colaborador?')) {
      await employeeService.delete(id);
      setEmployees(prev => prev.filter(emp => emp.id !== id));
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.nomeCompleto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.cargo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <EmployeeModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        employeeToEdit={employeeToEdit}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Colaboradores</h1>
          <p className="text-slate-500 font-medium">Gerencie as informações dos funcionários da empresa.</p>
        </div>
        <button 
          onClick={() => { setEmployeeToEdit(null); setIsModalOpen(true); }}
          className="group flex items-center gap-3 bg-slate-900 hover:bg-primary text-white font-bold py-4 px-8 rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-95"
        >
          <Plus size={22} className="group-hover:rotate-90 transition-transform duration-300" />
          <span>Adicionar Colaborador</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Buscar por nome ou cargo..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Colaborador</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Cargo</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Setor</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-slate-50">
                    <td className="py-6 px-6"><div className="h-10 bg-slate-100 rounded-full w-10"></div></td>
                    <td colSpan={4} className="py-6 px-6"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                  </tr>
                ))
              ) : filteredEmployees.length > 0 ? (
                filteredEmployees.map(emp => (
                  <EmployeeRow 
                    key={emp.id} 
                    employee={emp} 
                    onEdit={(e) => { setEmployeeToEdit(e); setIsModalOpen(true); }}
                    onDelete={handleDelete} 
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400 font-bold">Nenhum colaborador encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Employees;