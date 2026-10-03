import React, { useState } from 'react';
import { Briefcase, Plus, Building2 } from 'lucide-react';
import type { Department, DepartmentForm, Role, RoleForm } from '../../services/departmentsRolesService';
import {
  useCargos, useDepartamentos, useExcluirCargo, useExcluirDepartamento, useSalvarCargo, useSalvarDepartamento,
} from '../../queries/estrutura';
import DepartmentCard from '../../components/Admin/OrgDepartmentCard';
import RolesTable from '../../components/Admin/OrgRolesTable';
import FormModal from '../../components/Admin/OrgFormModal';
import ErrorAlert from '../../components/ErrorAlert';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Tabs, { TabPanel, type TabItem } from '../../components/ui/Tabs';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useConfirm } from '../../components/ui/confirmContext';
import { useToast } from '../../components/ui/toastContext';
import { mensagemDeErro } from '../../utils/erros';
import { usePageTitle } from '../../hooks/usePageTitle';

type Aba = 'depts' | 'roles';

const ABAS: readonly TabItem<Aba>[] = [
  { id: 'depts', label: 'Departamentos', icon: <Building2 size={18} /> },
  { id: 'roles', label: 'Cargos e Funções', icon: <Briefcase size={18} /> },
];

type ModalConfig = { isOpen: false } | { isOpen: true; type: 'department'; item: Department | null } | { isOpen: true; type: 'role'; item: Role | null };

const CHIP = 'rounded-full border px-4 py-2 text-xs font-semibold transition-colors';

const DepartmentsRoles: React.FC = () => {
  usePageTitle('Departamentos e cargos');
  const confirmar = useConfirm();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Aba>('depts');
  const [roleFilter, setRoleFilter] = useState('Todos');
  const [modalConfig, setModalConfig] = useState<ModalConfig>({ isOpen: false });

  // Recarregar depois de salvar ou excluir não troca a tela por um carregando: o cache mantém os dados
  // e o botão que abriu o diálogo continua no DOM. Só o primeiro carregamento mostra o indicador.
  const departamentos = useDepartamentos();
  const cargos = useCargos();
  const salvarDepartamento = useSalvarDepartamento();
  const salvarCargo = useSalvarCargo();
  const excluirDepartamento = useExcluirDepartamento();
  const excluirCargo = useExcluirCargo();

  const departments = departamentos.data ?? [];
  const roles = cargos.data ?? [];
  const loading = departamentos.isPending || cargos.isPending;
  const falha = departamentos.error ?? cargos.error;
  const loadError = falha ? mensagemDeErro(falha, 'Erro ao carregar estrutura organizacional') : null;
  const reload = () => { departamentos.refetch(); cargos.refetch(); };

  const filteredRoles = roleFilter === 'Todos'
    ? roles
    : roles.filter((r) => r.departmentId === roleFilter);

  const trocarAba = (aba: Aba) => {
    setActiveTab(aba);
    if (aba === 'depts') setRoleFilter('Todos');
  };

  // O erro sobe até o modal, que o mostra junto ao formulário e mantém o que foi digitado.
  const handleSave = async (data: DepartmentForm | RoleForm) => {
    if (!modalConfig.isOpen) return;
    const departamento = 'name' in data;
    if ('title' in data) await salvarCargo.mutateAsync(data);
    else await salvarDepartamento.mutateAsync(data);

    setModalConfig({ isOpen: false });
    toast.success(departamento ? 'Departamento salvo.' : 'Cargo salvo.');
  };

  const handleDeleteDepartment = async (dept: Department) => {
    const confirmado = await confirmar({
      title: `Excluir o departamento "${dept.name}"?`,
      description: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      tone: 'danger',
    });
    if (!confirmado) return;
    try {
      await excluirDepartamento.mutateAsync(dept.id);
      toast.success(`Departamento "${dept.name}" excluído.`);
    } catch (error) {
      toast.error(mensagemDeErro(error, 'Erro ao excluir departamento.'));
    }
  };

  const handleDeleteRole = async (role: Role) => {
    const confirmado = await confirmar({
      title: `Excluir o cargo "${role.title}"?`,
      description: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      tone: 'danger',
    });
    if (!confirmado) return;
    try {
      await excluirCargo.mutateAsync(role.id);
      toast.success(`Cargo "${role.title}" excluído.`);
    } catch (error) {
      toast.error(mensagemDeErro(error, 'Erro ao excluir cargo.'));
    }
  };

  const abrirCriacao = () => setModalConfig(activeTab === 'depts' ? { isOpen: true, type: 'department', item: null } : { isOpen: true, type: 'role', item: null });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Departamentos & Cargos"
        description="Gerencie a hierarquia e os centros de custo da empresa."
        actions={(
          <Button size="lg" icon={<Plus size={20} aria-hidden="true" />} onClick={abrirCriacao}>
            Criar {activeTab === 'depts' ? 'Departamento' : 'Cargo'}
          </Button>
        )}
      />

      <Tabs tabs={ABAS} value={activeTab} onChange={trocarAba} label="Estrutura da empresa" idPrefix="estrutura" variant="pill" />

      <TabPanel idPrefix="estrutura" id={activeTab} className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-ink-muted">
            <Spinner size="lg" rotulo="Carregando estrutura" />
            <p className="font-semibold">Carregando estrutura...</p>
          </div>
        ) : loadError ? (
          <ErrorAlert message={loadError} onRetry={reload} />
        ) : activeTab === 'depts' ? (
          departments.length === 0 ? (
            <EmptyState icon={<Building2 size={28} />} title="Nenhum departamento cadastrado" description="Crie o primeiro departamento para organizar a empresa." />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {departments.map((dept) => (
                <DepartmentCard
                  key={dept.id}
                  department={dept}
                  onEdit={() => setModalConfig({ isOpen: true, type: 'department', item: dept })}
                  onDelete={() => handleDeleteDepartment(dept)}
                />
              ))}
            </div>
          )
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar cargos por departamento">
              <button
                type="button"
                aria-pressed={roleFilter === 'Todos'}
                onClick={() => setRoleFilter('Todos')}
                className={`${CHIP} ${roleFilter === 'Todos' ? 'border-brand bg-brand text-white' : 'border-line-input bg-surface text-ink-muted hover:border-brand hover:text-brand'}`}
              >
                Todos ({roles.length})
              </button>
              {departments.map((dept) => (
                <button
                  type="button"
                  key={dept.id}
                  aria-pressed={roleFilter === dept.id}
                  onClick={() => setRoleFilter(dept.id)}
                  className={`${CHIP} ${roleFilter === dept.id ? 'border-brand bg-brand text-white' : 'border-line-input bg-surface text-ink-muted hover:border-brand hover:text-brand'}`}
                >
                  {dept.sigla} ({roles.filter((r) => r.departmentId === dept.id).length})
                </button>
              ))}
            </div>

            {filteredRoles.length === 0 ? (
              <EmptyState icon={<Briefcase size={28} />} title="Nenhum cargo encontrado" description="Não há cargos para o filtro escolhido." />
            ) : (
              <RolesTable
                roles={filteredRoles}
                onEdit={(role) => setModalConfig({ isOpen: true, type: 'role', item: role })}
                onDelete={handleDeleteRole}
              />
            )}
          </div>
        )}
      </TabPanel>

      {modalConfig.isOpen && (
        <FormModal
          type={modalConfig.type}
          item={modalConfig.item}
          departments={departments}
          onClose={() => setModalConfig({ isOpen: false })}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default DepartmentsRoles;
