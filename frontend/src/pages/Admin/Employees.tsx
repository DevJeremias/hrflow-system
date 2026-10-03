import React, { useState, useEffect, useCallback, useRef } from 'react';
import { KeyRound, Lock, Pencil, Plus, Search, Trash2, UserCheck, UserMinus, Users } from 'lucide-react';
import { Employee, EmployeeForm, employeeService } from '../../services/employeeService';
import EmployeeModal from '../../components/Admin/EmployeeModal';
import EmployeeLifecycleModal, { LifecycleAction, LifecycleKind } from '../../components/Admin/EmployeeLifecycleModal';
import ErrorAlert from '../../components/ErrorAlert';
import PageHeader from '../../components/ui/PageHeader';
import Button, { IconButton } from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Badge, { type BadgeTone } from '../../components/ui/Badge';
import DataTable, { type Column } from '../../components/ui/DataTable';
import EmptyState from '../../components/ui/EmptyState';
import Field, { Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/toastContext';
import { mensagemDeErro } from '../../utils/erros';
import { useAuth } from '../../contexts/AuthContext';
import { podeGerirCadastro, motivoDeNegacaoDoCadastro } from '../../utils/permissoes';
import { usePageTitle } from '../../hooks/usePageTitle';

const PAGE_SIZE = 50;

const TOM_DO_STATUS: Record<string, BadgeTone> = {
  Ativo: 'success',
  Inativo: 'neutral',
  Férias: 'warning',
};

// 'AAAA-MM-DD' -> 'DD/MM/AAAA', sem passar por Date (o fuso moveria o dia).
const formatDate = (isoDate: string) => isoDate.split('-').reverse().join('/');

const Employees: React.FC = () => {
  usePageTitle('Colaboradores');
  const { user } = useAuth();
  // Editar segue a matriz de permissões (docs/permissoes.md): o RH não alcança o próprio cadastro
  // nem o de RH ou Administrador. Situação, senha e exclusão valem para os outros, nunca para o próprio cadastro.
  const canEdit = (employee: Employee) => podeGerirCadastro(user, employee);
  const isManageable = (employee: Employee) => canEdit(employee) && !(user?.funcionarioId != null && String(user.funcionarioId) === employee.id);
  const toast = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction | null>(null);
  // Só o primeiro carregamento troca a lista por esqueletos: recarregar depois de salvar mantém as linhas
  // (e o botão que abriu o diálogo) no lugar.
  const carregado = useRef(false);

  const loadEmployees = useCallback(async (requestedPage: number) => {
    setLoading(!carregado.current);
    setLoadError(null);
    try {
      const result = await employeeService.getPage(requestedPage, PAGE_SIZE);
      setEmployees(result.employees);
      setTotalEmployees(result.total);
      setPage(requestedPage);
      carregado.current = true;
    } catch (error) {
      setLoadError(mensagemDeErro(error, 'Erro ao buscar colaboradores'));
      setEmployees([]);
      setTotalEmployees(0);
      carregado.current = false;
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
    toast.success('Colaborador salvo.');
  };

  const openLifecycle = (kind: LifecycleKind, employee: Employee) => setLifecycleAction({ kind, employee });

  // A página pode esvaziar com a exclusão: volta para a anterior.
  const handleLifecycleDone = () => loadEmployees(page - (lifecycleAction?.kind === 'delete' && employees.length === 1 && page > 1 ? 1 : 0));

  const filteredEmployees = employees.filter(emp =>
    emp.nomeCompleto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.cargo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(totalEmployees / PAGE_SIZE);

  const columns: Column<Employee>[] = [
    {
      key: 'colaborador',
      header: 'Colaborador',
      semRotuloNoCartao: true,
      cell: (emp) => (
        <span className="flex items-center gap-3">
          <Avatar name={emp.nomeCompleto || 'U'} src={emp.avatar} />
          <span className="min-w-0">
            <span className="block font-semibold text-ink">{emp.nomeCompleto}</span>
            <span className="block break-all text-xs text-ink-muted">{emp.emailPessoal}</span>
          </span>
        </span>
      ),
    },
    { key: 'cargo', header: 'Cargo', cell: (emp) => <span className="text-ink">{emp.cargo}</span> },
    { key: 'setor', header: 'Setor', cell: (emp) => <span className="text-ink-muted">{emp.departamento}</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (emp) => (
        <>
          <Badge tone={TOM_DO_STATUS[emp.status] ?? 'neutral'}>{emp.status || 'Ativo'}</Badge>
          {emp.status === 'Inativo' && emp.dataDesligamento && (
            <span className="mt-1 block text-xs text-ink-muted" title={emp.motivoDesligamento}>
              Desde {formatDate(emp.dataDesligamento)}{emp.motivoDesligamento ? ` · ${emp.motivoDesligamento}` : ''}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      semRotuloNoCartao: true,
      cell: (emp) => !canEdit(emp) ? (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-ink-muted" title={motivoDeNegacaoDoCadastro(user, emp)}>
          <Lock size={14} aria-hidden="true" />
          <span>Só o Administrador</span>
        </span>
      ) : (
        <span className="flex justify-end gap-1">
          <IconButton label={`Editar colaborador ${emp.nomeCompleto}`} size="sm" onClick={() => { setEmployeeToEdit(emp); setIsModalOpen(true); }}>
            <Pencil size={18} aria-hidden="true" />
          </IconButton>
          {isManageable(emp) && emp.perfilAcesso !== null && emp.status !== 'Inativo' && (
            <IconButton label={`Redefinir senha de ${emp.nomeCompleto}`} size="sm" onClick={() => openLifecycle('reset', emp)}>
              <KeyRound size={18} aria-hidden="true" />
            </IconButton>
          )}
          {isManageable(emp) && (emp.status === 'Inativo' ? (
            <IconButton label={`Reativar colaborador ${emp.nomeCompleto}`} size="sm" onClick={() => openLifecycle('reactivate', emp)}>
              <UserCheck size={18} aria-hidden="true" />
            </IconButton>
          ) : (
            <IconButton label={`Inativar ou desligar ${emp.nomeCompleto}`} size="sm" onClick={() => openLifecycle('offboard', emp)}>
              <UserMinus size={18} aria-hidden="true" />
            </IconButton>
          ))}
          {isManageable(emp) && !emp.temMovimento && (
            <IconButton label={`Excluir cadastro de ${emp.nomeCompleto}`} size="sm" onClick={() => openLifecycle('delete', emp)} className="hover:text-danger">
              <Trash2 size={18} aria-hidden="true" />
            </IconButton>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
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

      <PageHeader
        title="Colaboradores"
        description="Gerencie as informações dos funcionários da empresa."
        actions={(
          <Button size="lg" icon={<Plus size={20} aria-hidden="true" />} onClick={() => { setEmployeeToEdit(null); setIsModalOpen(true); }}>
            Adicionar Colaborador
          </Button>
        )}
      />

      <Card padding="sm">
        <div className="max-w-md">
          <Field label="Buscar colaborador" name="busca" hideLabel>
            <Input
              type="search"
              autoComplete="off"
              icon={<Search size={18} />}
              placeholder="Buscar nesta página por nome ou cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      {loadError && <ErrorAlert message={loadError} onRetry={() => loadEmployees(page)} />}

      {!loadError && (
        <DataTable
          caption="Colaboradores da empresa"
          columns={columns}
          rows={filteredEmployees}
          rowKey={(emp) => emp.id}
          loading={loading}
          className="rounded-card md:border md:border-line md:bg-surface md:shadow-card"
          empty={<Card><EmptyState icon={<Users size={28} />} title="Nenhum colaborador encontrado." /></Card>}
        />
      )}

      {!loadError && !loading && (
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-ink-muted">
          <span>
            {totalEmployees === 0 ? 'Nenhum colaborador' : `Página ${page} de ${totalPages} · ${totalEmployees} colaboradores`}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => loadEmployees(page - 1)} disabled={page <= 1}>Anterior</Button>
            <Button variant="secondary" size="sm" onClick={() => loadEmployees(page + 1)} disabled={page >= totalPages}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
