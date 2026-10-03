import React, { useEffect, useState } from 'react';
import { KeyRound, Lock, Pencil, Plus, Search, Trash2, UserCheck, UserMinus, Users } from 'lucide-react';
import { Employee, EmployeeForm } from '../../services/employeeService';
import { useFuncionarios, useInvalidarPorColaboradores, useSalvarColaborador } from '../../queries/funcionarios';
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
const ATRASO_DA_BUSCA_MS = 300;

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
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [busca, setBusca] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction | null>(null);

  // A busca vai ao servidor depois de uma pausa na digitação: encontra qualquer colaborador da
  // empresa, não só os da página aberta.
  useEffect(() => {
    const termo = searchTerm.trim();
    if (termo === busca) return undefined;
    const timer = setTimeout(() => {
      setBusca(termo);
      setPage(1);
    }, ATRASO_DA_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [searchTerm, busca]);

  // Só o primeiro carregamento troca a lista por esqueletos: recarregar depois de salvar, trocar de
  // página ou buscar mantém as linhas (e o botão que abriu o diálogo) no lugar.
  const { data, error, isPending, isPlaceholderData, refetch } = useFuncionarios({ pagina: page, limite: PAGE_SIZE, busca });
  const salvar = useSalvarColaborador();
  const invalidar = useInvalidarPorColaboradores();

  const employees = data?.employees ?? [];
  const totalEmployees = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalEmployees / PAGE_SIZE));
  const loadError = error ? mensagemDeErro(error, 'Erro ao buscar colaboradores') : null;
  const loading = isPending;

  // O erro sobe até o modal, que o mostra junto ao formulário e mantém o que foi digitado.
  // Os dados vão por PUT; a situação (Férias, Inativo com data e motivo) só muda por PATCH.
  const handleSave = async (employeeData: EmployeeForm) => {
    await salvar.mutateAsync({ dados: employeeData, original: employeeToEdit });
    setIsModalOpen(false);
    toast.success('Colaborador salvo.');
  };

  const openLifecycle = (kind: LifecycleKind, employee: Employee) => setLifecycleAction({ kind, employee });

  // A página pode esvaziar com a exclusão: volta para a anterior.
  const handleLifecycleDone = async () => {
    if (lifecycleAction?.kind === 'delete' && employees.length === 1 && page > 1) setPage(page - 1);
    await invalidar();
  };

  const columns: Column<Employee>[] = [
    {
      key: 'colaborador',
      header: 'Colaborador',
      semRotuloNoCartao: true,
      cell: (emp) => (
        <span className="flex items-center gap-3">
          <Avatar name={emp.nomeCompleto || 'U'} />
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
              placeholder="Buscar por nome, e-mail, CPF, cargo ou setor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      {loadError && <ErrorAlert message={loadError} onRetry={() => { refetch(); }} />}

      {!loadError && (
        <DataTable
          caption="Colaboradores da empresa"
          columns={columns}
          rows={employees}
          rowKey={(emp) => emp.id}
          loading={loading}
          className={`rounded-card transition-opacity md:border md:border-line md:bg-surface md:shadow-card ${isPlaceholderData ? 'opacity-60' : ''}`}
          empty={<Card><EmptyState icon={<Users size={28} />} title="Nenhum colaborador encontrado." /></Card>}
        />
      )}

      {!loadError && !loading && (
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-ink-muted">
          <span>
            {totalEmployees === 0 ? 'Nenhum colaborador' : `Página ${page} de ${totalPages} · ${totalEmployees} colaboradores`}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>Anterior</Button>
            <Button variant="secondary" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
