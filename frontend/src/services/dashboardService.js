import { buscarColaboradores } from './colaboradoresService';

// Mantemos os dados falsos (mock) para as partes do sistema que 
// ainda não tem tabela no banco de dados (Avisos, Férias, Aniversários)
const mockDashboardData = {
  estatisticas: {
    totalColaboradores: 0, // será substituído pela API
    aniversariantesMes: 1,
    solicitacoesPendentes: 4,
    presencaHoje: "0/0"    // será substituído pela API
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
  try {
    // 1. Vai no seu banco de dados real e busca os funcionários
    const colaboradoresReais = await buscarColaboradores();
    
    // 2. Conta quantas pessoas vieram na lista
    const totalReal = colaboradoresReais.length;

    // 3. Devolve o pacote misturando os dados reais com os dados de layout
    return {
      ...mockDashboardData,
      estatisticas: {
        ...mockDashboardData.estatisticas,
        totalColaboradores: totalReal, // AQUI ENTRA O DADO REAL!
        presencaHoje: `${totalReal}/${totalReal}` // Faz uma brincadeira simulando 100% de presença
      }
    };
  } catch (erro) {
    console.error("Erro ao puxar dados reais pro dashboard:", erro);
    
    // Se der problema na conexão, devolve os dados falsos originais 
    // pro sistema não capotar e mostrar a "tela azul"
    return mockDashboardData;
  }
};