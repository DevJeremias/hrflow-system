import React, { useState, useEffect } from 'react';
import { Users, Building2, Briefcase, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardService, DashboardSummary } from '../../services/dashboardService';
import StatCard from '../../components/Admin/DashboardStatCard';
import RecentActivities from '../../components/Admin/DashboardActivities';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';

const Dashboard: React.FC = () => {
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
    { label: 'Colaboradores', value: data.activeEmployees, to: '/admin/colaboradores', hint: inactive > 0 ? `${inactive} ${inactive === 1 ? 'inativo' : 'inativos'}` : undefined, icon: <Users size={24} className="text-white" />, color: 'bg-blue-500', shadow: 'shadow-blue-500/30' },
    { label: 'Departamentos', value: data.departments, to: '/admin/estrutura', icon: <Building2 size={24} className="text-white" />, color: 'bg-indigo-500', shadow: 'shadow-indigo-500/30' },
    { label: 'Cargos Cadastrados', value: data.roles, to: '/admin/estrutura', icon: <Briefcase size={24} className="text-white" />, color: 'bg-purple-500', shadow: 'shadow-purple-500/30' },
    { label: 'Marcações Hoje', value: data.punchesToday, to: '/admin/gestao-ponto', icon: <Clock size={24} className="text-white" />, color: 'bg-orange-500', shadow: 'shadow-orange-500/30' },
  ] : [];

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 font-medium mt-2 text-lg">
            Bem-vindo de volta, <span className="text-primary font-bold">{firstName}</span>!
          </p>
        </div>
      </div>

      {loadError && <ErrorAlert message={loadError} onRetry={retry} />}

      {/* Grid de Cards com Skeleton Loading */}
      {!loadError && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-3xl animate-pulse" />)
            : statConfig.map((stat) => <StatCard key={stat.label} {...stat} />)
          }
        </div>
      )}

      <RecentActivities isLoading={isLoading} />
    </div>
  );
};

export default Dashboard;