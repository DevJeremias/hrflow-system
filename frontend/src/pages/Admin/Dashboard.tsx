import React from 'react';
import { Users, Building2, Briefcase, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useResumoDoDashboard } from '../../queries/dashboard';
import StatCard from '../../components/Admin/DashboardStatCard';
import RecentActivities from '../../components/Admin/DashboardActivities';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import { ehAdministrador } from '../../utils/sessao';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  
 
  const firstName = user?.nome?.split(' ')[0] || 'Gestor';

  const { data, error, isPending, refetch } = useResumoDoDashboard();
  const isLoading = isPending;
  const loadError = error ? mensagemDeErro(error, 'Erro ao carregar o resumo do dashboard') : null;

  // Só o Administrador alcança a estrutura; para o RH os números ficam sem link.
  const structureLink = ehAdministrador(user?.role) ? '/admin/estrutura' : undefined;
  const inactive = data?.inactiveEmployees ?? 0;
  const statConfig = data ? [
    { label: 'Colaboradores', value: data.activeEmployees, to: '/admin/colaboradores', hint: inactive > 0 ? `${inactive} ${inactive === 1 ? 'inativo' : 'inativos'}` : undefined, icon: <Users size={24} className="text-white" />, color: 'bg-blue-500', shadow: 'shadow-blue-500/30' },
    { label: 'Departamentos', value: data.departments, to: structureLink, icon: <Building2 size={24} className="text-white" />, color: 'bg-indigo-500', shadow: 'shadow-indigo-500/30' },
    { label: 'Cargos Cadastrados', value: data.roles, to: structureLink, icon: <Briefcase size={24} className="text-white" />, color: 'bg-purple-500', shadow: 'shadow-purple-500/30' },
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

      {loadError && <ErrorAlert message={loadError} onRetry={() => { refetch(); }} />}

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