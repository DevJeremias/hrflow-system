// src/services/dashboardService.ts

export interface DashboardStats {
  totalEmployees: number;
  totalDepartments: number;
  totalRoles: number;
  pendingApprovals: number;
}

export interface ChartData {
  month: string;
  admissions: number;
}

export interface RecentActivity {
  id: string;
  type: 'cadastro' | 'promocao' | 'ferias';
  title: string;
  description: string;
  timeAgo: string;
  color: string;
}

export interface DashboardData {
  stats: DashboardStats;
  chartData: ChartData[];
  recentActivities: RecentActivity[];
}

export const dashboardService = {
  getDashboardData: async (): Promise<DashboardData> => {
    // Simula a requisição
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return {
      stats: {
        totalEmployees: 16,
        totalDepartments: 5,
        totalRoles: 13,
        pendingApprovals: 5,
      },
      chartData: [
        { month: 'Jan', admissions: 2 },
        { month: 'Fev', admissions: 4 },
        { month: 'Mar', admissions: 3 },
        { month: 'Abr', admissions: 7 },
      ],
      recentActivities: [
        {
          id: '1',
          type: 'cadastro',
          title: 'Novo colaborador cadastrado',
          description: 'João Silva - Departamento de TI',
          timeAgo: 'Há 2 horas',
          color: 'bg-blue-500',
        },
        {
          id: '2',
          type: 'promocao',
          title: 'Atualização de cargo',
          description: 'Maria Santos promovida a Gerente',
          timeAgo: 'Ontem',
          color: 'bg-purple-500',
        },
        {
          id: '3',
          type: 'ferias',
          title: 'Férias aprovadas',
          description: 'Carlos Pereira (15 a 30 de Nov)',
          timeAgo: 'Ontem',
          color: 'bg-orange-500',
        },
      ],
    };
  },
};