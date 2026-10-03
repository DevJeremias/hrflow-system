import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, KeyRound, UserMinus, UserCheck, Lock } from 'lucide-react';
import { Employee, EmployeeForm, employeeService } from '../../services/employeeService';
import EmployeeModal from '../../components/Admin/EmployeeModal';
import EmployeeLifecycleModal, { LifecycleAction, LifecycleKind } from '../../components/Admin/EmployeeLifecycleModal';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import { useAuth } from '../../contexts/AuthContext';
import { podeGerirCadastro, motivoDeNegacaoDoCadastro } from '../../utils/permissoes';

const PAGE_SIZE = 50;

// 'AAAA-MM-DD' -> 'DD/MM/AAAA', sem passar por Date (o fuso moveria o dia).
const formatDate = (isoDate: string) => isoDate.split('-').reverse().join('/');

const Employees: React.FC = () => {
  const { user } = useAuth();
  // Editar segue a matriz de permissões (docs/permissoes.md): o RH não alcança o próprio cadastro
  // nem o de RH ou Administrador. Situação, senha e exclusão valem para os outros, nunca para o próprio cadastro.
  const canEdit = (employee: Employee) => podeGerirCadastro(user, employee);
  const isManageable = (employee: Employee) => canEdit(employee) && !(user?.funcionarioId != null && String(user.funcionarioId) === employee.id);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction | null>(null);

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
  // Os dados vão por PUT; a situação (Férias, Inativo com data e motivo) só muda por PATCH.
  const handleSave = async (employeeData: EmployeeForm) => {
    await employeeService.save(employeeData);
    if (employeeToEdit) {
      const { status = 'Ativo', dataDesligamento = '', motivoDesligamento = '' } = employeeData;
      const changed = status !== employeeToEdit.status
        || (status === 'Inativo' && (dataDesligamento !== employeeToEdit.dataDesligamento || motivoDesligamento !== employeeToEdit.motivoDesligamento));
      if (changed) {
        await employeeService.changeStatus(employeeToEdit.id, status === 'Inativo'
          ? { status, date: dataDesligamento, reason: motivoDesligamento.trim() }
          : { status: status as 'Ativo' | 'Férias' });
      }
    }
    await loadEmployees(page);
    setIsModalOpen(false);
  };

  const openLifecycle = (kind: LifecycleKind, employee: Employee) => setLifecycleAction({ kind, employee });

  // A página pode esvaziar com a exclusão: volta para a anterior.
  const handleLifecycleDone = () => loadEmployees(page - (lifecycleAction?.kind === 'delete' && employees.length === 1 && page > 1 ? 1 : 0));

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

      {lifecycleAction && (
        <EmployeeLifecycleModal
          action={lifecycleAction}
          onClose={() => setLifecycleAction(null)}
          onDone={handleLifecycleDone}
        />
      )}

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
                      {emp.status === 'Inativo' && emp.dataDesligamento && (
                        <p className="mt-1 text-xs text-slate-500" title={emp.motivoDesligamento}>
                          Desde {formatDate(emp.dataDesligamento)}{emp.motivoDesligamento ? ` · ${emp.motivoDesligamento}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {!canEdit(emp) ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 whitespace-nowrap" title={motivoDeNegacaoDoCadastro(user, emp)}>
                          <Lock size={14} />
                          <span>Só o Administrador</span>
                        </span>
                      ) : (
                      <div className="flex justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEmployeeToEdit(emp); setIsModalOpen(true); }}
                          className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                          title="Editar Colaborador"
                          aria-label="Editar Colaborador"
                        >
                          <Edit2 size={18} />
                        </button>
                        {isManageable(emp) && emp.perfilAcesso !== null && emp.status !== 'Inativo' && (
                          <button
                            onClick={() => openLifecycle('reset', emp)}
                            className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors"
                            title="Redefinir Senha"
                            aria-label="Redefinir Senha"
                          >
                            <KeyRound size={18} />
                          </button>
                        )}
                        {isManageable(emp) && (emp.status === 'Inativo' ? (
                          <button
                            onClick={() => openLifecycle('reactivate', emp)}
                            className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                            title="Reativar Colaborador"
                            aria-label="Reativar Colaborador"
                          >
                            <UserCheck size={18} />
                          </button>
                        ) : (
                          <button
                            onClick={() => openLifecycle('offboard', emp)}
                            className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
                            title="Inativar ou Desligar"
                            aria-label="Inativar ou Desligar"
                          >
                            <UserMinus size={18} />
                          </button>
                        ))}
                        {isManageable(emp) && !emp.temMovimento && (
                          <button 
                            onClick={() => openLifecycle('delete', emp)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                            title="Excluir Cadastro"
                            aria-label="Excluir Cadastro"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
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