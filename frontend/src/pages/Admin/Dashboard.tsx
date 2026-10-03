import React, { useState, useEffect } from 'react';
import { Users, Building2, Briefcase, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardService, DashboardSummary } from '../../services/dashboardService';
import StatCard from '../../components/ui/StatCard';
import PageHeader from '../../components/ui/PageHeader';
import Skeleton from '../../components/ui/Skeleton';
import RecentActivities from '../../components/Admin/DashboardActivities';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import { usePageTitle } from '../../hooks/usePageTitle';

const Dashboard: React.FC = () => {
  usePageTitle('Dashboard');
  const { user } = useAuth();
  const firstName = user?.nome?.split(' ')[0] || 'Gestor';

  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    dashboardService.getSummary()
      .then((summary) => { if (active) setData(summary); })
      .catch((error) => { if (active) setLoadError(mensagemDeErro(error, 'Erro ao carregar o resumo do dashboard')); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const retry = () => {
    setIsLoading(true);
    setLoadError(null);
    setReloadKey((key) => key + 1);
  };

  const inactive = data?.inactiveEmployees ?? 0;
  const statConfig = data ? [
    { label: 'Colaboradores', value: data.activeEmployees, to: '/admin/colaboradores', hint: inactive > 0 ? `${inactive} ${inactive === 1 ? 'inativo' : 'inativos'}` : undefined, icon: <Users size={24} />, tone: 'brand' as const },
    { label: 'Departamentos', value: data.departments, to: '/admin/estrutura', icon: <Building2 size={24} />, tone: 'brand' as const },
    { label: 'Cargos Cadastrados', value: data.roles, to: '/admin/estrutura', icon: <Briefcase size={24} />, tone: 'brand' as const },
    { label: 'Marcações Hoje', value: data.punchesToday, to: '/admin/gestao-ponto', icon: <Clock size={24} />, tone: 'warning' as const },
  ] : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Dashboard"
        description={<>Bem-vindo de volta, <span className="font-semibold text-brand">{firstName}</span>!</>}
      />

      {loadError && <ErrorAlert message={loadError} onRetry={retry} />}

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
