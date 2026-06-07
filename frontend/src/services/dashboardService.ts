// frontend/src/services/dashboardService.ts

export interface DashboardData {
  stats: {
    totalEmployees: number;
    totalDepartments: number;
    totalRoles: number;
    pendingApprovals: number;
  };
  recentActivities: any[];
}

export const dashboardService = {
  getDashboardData: async (): Promise<DashboardData> => {
    // Simulamos um pequeno atraso de rede (500ms) para que a animação 
    // de carregamento (pulse) do Dashboard seja exibida suavemente.
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          stats: {
            totalEmployees: 0,
            totalDepartments: 0,
            totalRoles: 0,
            pendingApprovals: 0
          },
          recentActivities: []
        });
      }, 500);
    });
  },
  
  // Mantidos por retrocompatibilidade caso outras telas utilizem
  getDashboardMetrics: async () => ({}),
  getRecentActivities: async () => [],
};