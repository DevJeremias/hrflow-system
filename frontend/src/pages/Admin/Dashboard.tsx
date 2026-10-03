import React from 'react';
import { Users, Building2, Briefcase, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useResumoDoDashboard } from '../../queries/dashboard';
import StatCard from '../../components/ui/StatCard';
import PageHeader from '../../components/ui/PageHeader';
import Skeleton from '../../components/ui/Skeleton';
import RecentActivities from '../../components/Admin/DashboardActivities';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import { ehAdministrador } from '../../utils/sessao';
import { usePageTitle } from '../../hooks/usePageTitle';

const Dashboard: React.FC = () => {
  usePageTitle('Dashboard');
  const { user } = useAuth();
  const firstName = user?.nome?.split(' ')[0] || 'Gestor';

  const { data, error, isPending, refetch } = useResumoDoDashboard();
  const isLoading = isPending;
  const loadError = error ? mensagemDeErro(error, 'Erro ao carregar o resumo do dashboard') : null;

  // Só o Administrador alcança a estrutura; para o RH os números ficam sem link.
  const structureLink = ehAdministrador(user?.role) ? '/admin/estrutura' : undefined;
  const inactive = data?.inactiveEmployees ?? 0;
  const statConfig = data ? [
    { label: 'Colaboradores', value: data.activeEmployees, to: '/admin/colaboradores', hint: inactive > 0 ? `${inactive} ${inactive === 1 ? 'inativo' : 'inativos'}` : undefined, icon: <Users size={24} />, tone: 'brand' as const },
    { label: 'Departamentos', value: data.departments, to: structureLink, icon: <Building2 size={24} />, tone: 'brand' as const },
    { label: 'Cargos Cadastrados', value: data.roles, to: structureLink, icon: <Briefcase size={24} />, tone: 'brand' as const },
    { label: 'Marcações Hoje', value: data.punchesToday, to: '/admin/gestao-ponto', icon: <Clock size={24} />, tone: 'warning' as const },
  ] : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Dashboard"
        description={<>Bem-vindo de volta, <span className="font-semibold text-brand">{firstName}</span>!</>}
      />

      {loadError && <ErrorAlert message={loadError} onRetry={() => { refetch(); }} />}

      {!loadError && (
        <div aria-busy={isLoading || undefined} className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-card" />)
            : statConfig.map((stat) => <StatCard key={stat.label} {...stat} />)}
        </div>
      )}

      <RecentActivities isLoading={isLoading} />
    </div>
  );
};

export default Dashboard;
