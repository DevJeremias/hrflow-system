import React, { useState, useEffect } from 'react';
import { Users, Building2, Briefcase, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardService, DashboardData } from '../../services/dashboardService';
import StatCard from '../../components/Admin/DashboardStatCard';
import RecentActivities from '../../components/Admin/DashboardActivities';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  
 
  const firstName = user?.nome?.split(' ')[0] || 'Gestor';

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const dashboardData = await dashboardService.getDashboardData();
        setData(dashboardData);
      } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, []);


  const statConfig = [
    { label: 'Colaboradores', value: data?.stats?.totalEmployees || 0, icon: <Users size={24} className="text-white" />, color: 'bg-blue-500', shadow: 'shadow-blue-500/30' },
    { label: 'Departamentos', value: data?.stats?.totalDepartments || 0, icon: <Building2 size={24} className="text-white" />, color: 'bg-indigo-500', shadow: 'shadow-indigo-500/30' },
    { label: 'Cargos Cadastrados', value: data?.stats?.totalRoles || 0, icon: <Briefcase size={24} className="text-white" />, color: 'bg-purple-500', shadow: 'shadow-purple-500/30' },
    { label: 'Aprovações Pendentes', value: data?.stats?.pendingApprovals || 0, icon: <Clock size={24} className="text-white" />, color: 'bg-orange-500', shadow: 'shadow-orange-500/30', alert: true },
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

      {/* Grid de Cards com Skeleton Loading */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {isLoading 
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-3xl animate-pulse" />)
          : statConfig.map((stat, i) => <StatCard key={i} {...stat} />)
        }
      </div>

      <RecentActivities activities={data?.recentActivities} isLoading={isLoading} />
    </div>
  );
};

export default Dashboard;