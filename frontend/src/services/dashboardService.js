// src/services/dashboardService.js

// Este é o "pacote" completo que a API vai devolver quando a tela carregar
const mockDashboardData = {
  estatisticas: {
    totalColaboradores: 6,
    aniversariantesMes: 1,
    solicitacoesPendentes: 4,
    presencaHoje: "5/6"
  },
  aniversarianteDestaque: {
    name: "Mariana Costa Ferreira",
    role: "Designer UX/UI",
    date: "9 de Março",
    avatar: "https://i.pravatar.cc/150?u=mariana"
  },
  solicitacoes: [
    {
      id: 1,
      name: 'Ana Silva Santos',
      type: 'Férias',
      period: '31 de março - 14 de abril, 2026',
    },
    {
      id: 2,
      name: 'Mariana Costa Ferreira',
      type: 'Férias',
      period: '09 de maio - 23 de maio, 2026',
    }
  ],
  avisos: [
    {
      id: 1,
      title: "Reunião Geral - Resultados Q1 2026",
      desc: "Prezados colaboradores, informamos que no dia 20/03 às 14h teremos nossa reunião geral...",
      tag: "Administração"
    },
    {
      id: 2,
      title: "Manutenção no Sistema",
      desc: "No sábado (18/03) das 8h às 12h, nossos sistemas passarão por manutenção preventiva.",
      tag: "TI"
    }
  ]
};

// A função que o seu componente Dashboard vai chamar
export const buscarDadosDashboard = async () => {
  return new Promise((resolve) => {
    // Simulando o tempo de ir ao banco de dados e voltar
    setTimeout(() => {
      resolve(mockDashboardData);
    }, 600);
  });
};