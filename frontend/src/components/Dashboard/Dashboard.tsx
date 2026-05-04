import React, { useState, useEffect } from 'react';
import { Users, Building2, Briefcase, Clock, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { dashboardService, DashboardData } from '../../services/dashboardService';
import StatCard from './StatCard';
import RecentActivities from './RecentActivities';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] || 'Gestor';

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const dashboardData = await dashboardService.getDashboardData();
        setData(dashboardData);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const statConfig = [
    { label: 'Colaboradores', value: data?.stats.totalEmployees || 0, icon: <Users size={24} className="text-white" />, color: 'bg-blue-500', shadow: 'shadow-blue-500/30' },
    { label: 'Departamentos', value: data?.stats.totalDepartments || 0, icon: <Building2 size={24} className="text-white" />, color: 'bg-indigo-500', shadow: 'shadow-indigo-500/30' },
    { label: 'Cargos Cadastrados', value: data?.stats.totalRoles || 0, icon: <Briefcase size={24} className="text-white" />, color: 'bg-purple-500', shadow: 'shadow-purple-500/30' },
    { label: 'Aprovações Pendentes', value: data?.stats.pendingApprovals || 0, icon: <Clock size={24} className="text-white" />, color: 'bg-orange-500', shadow: 'shadow-orange-500/30', alert: true },
  ];

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

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {isLoading 
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-3xl animate-pulse" />)
          : statConfig.map((stat, i) => <StatCard key={i} {...stat} />)
        }
      </div>

      {/* Seção Inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Placeholder do Gráfico */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-xl p-8">
          <h2 className="text-xl font-black text-slate-900 mb-8">Crescimento da Equipe</h2>
          <div className="h-64 w-full bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
            {isLoading ? <Loader2 size={32} className="animate-spin" /> : <TrendingUp size={32} />}
            <span className="mt-2 text-sm font-semibold">Dados carregados via DashboardService</span>
          </div>
        </div>

        {/* Componente de Atividades */}
        <RecentActivities activities={data?.recentActivities} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default Dashboard; 