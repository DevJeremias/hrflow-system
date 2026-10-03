import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Lock } from 'lucide-react';
import { Employee, EmployeeForm, employeeService } from '../../services/employeeService';
import EmployeeModal from '../../components/Admin/EmployeeModal';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import { useAuth } from '../../contexts/AuthContext';
import { podeGerirCadastro, motivoDeNegacaoDoCadastro } from '../../utils/permissoes';

const PAGE_SIZE = 50;

const Employees: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);

  const loadEmployees = useCallback(async (requestedPage: number) => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await employeeService.getPage(requestedPage, PAGE_SIZE);
      setEmployees(result.employees);
      setTotalEmployees(result.total);
      setPage(requestedPage);
    } catch (error) {
      setLoadError(mensagemDeErro(error, 'Erro ao buscar colaboradores'));
      setEmployees([]);
      setTotalEmployees(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadEmployees(1));
  }, [loadEmployees]);

  // O erro sobe até o modal, que o mostra junto ao formulário e mantém o que foi digitado.
  const handleSave = async (employeeData: EmployeeForm) => {
    await employeeService.save(employeeData);
    await loadEmployees(page);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem a certeza que deseja excluir este colaborador?')) {
      try {
        await employeeService.delete(id);
        await loadEmployees(page - (employees.length === 1 && page > 1 ? 1 : 0));
      } catch (error) {
        alert(mensagemDeErro(error, 'Erro ao excluir colaborador.'));
      }
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.nomeCompleto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.cargo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      Ativo: 'bg-emerald-100 text-emerald-700',
      Inativo: 'bg-slate-100 text-slate-600',
      Férias: 'bg-amber-100 text-amber-700',
    };
    return statusColors[status] || 'bg-slate-100 text-slate-600';
  };

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
            placeholder="Buscar nesta página por nome ou cargo..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loadError && <ErrorAlert message={loadError} onRetry={() => loadEmployees(page)} />}

      {!loadError && (
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
                  <tr key={emp.id} className="group hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm overflow-hidden">
                          {emp.avatar ? (
                            <img src={emp.avatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            emp.nomeCompleto?.charAt(0) || 'U'
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{emp.nomeCompleto}</p>
                          <p className="text-xs text-slate-500">{emp.emailPessoal}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm font-medium text-slate-700">{emp.cargo}</td>
                    <td className="py-4 px-6 text-sm text-slate-500">{emp.departamento}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(emp.status)}`}>
                        {emp.status || 'Ativo'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {podeGerirCadastro(user, emp) ? (
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setEmployeeToEdit(emp); setIsModalOpen(true); }}
                            className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                            title="Editar Colaborador"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(emp.id)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                            title="Excluir Colaborador"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400" title={motivoDeNegacaoDoCadastro(user, emp)}>
                          <Lock size={14} />
                          <span>Só o Administrador</span>
                        </span>
                      )}
                    </td>
                  </tr>
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
      )}
      {!loadError && !loading && (
        <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
          <span>
            {totalEmployees === 0 ? 'Nenhum colaborador' : `Página ${page} de ${Math.ceil(totalEmployees / PAGE_SIZE)} · ${totalEmployees} colaboradores`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadEmployees(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >Anterior</button>
            <button
              type="button"
              onClick={() => loadEmployees(page + 1)}
              disabled={page >= Math.ceil(totalEmployees / PAGE_SIZE)}
              className="rounded-lg border border-slate-200 px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >Próxima</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;