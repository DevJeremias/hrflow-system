// Chaves do cache de dados do servidor (TanStack Query). A primeira posição é a área: invalidar
// uma área derruba todas as consultas dela, de qualquer filtro ou página.
import type { EmployeeQuery } from '../services/employeeService';
import type { AuditoriaQuery } from '../services/auditoriaService';
import type { StatusDoPedidoApi } from '../types/api';

export const chaves = {
  funcionarios: ['funcionarios'] as const,
  paginaDeFuncionarios: (consulta: EmployeeQuery) => ['funcionarios', 'pagina', consulta] as const,
  dependentes: (funcionarioId: string) => ['funcionarios', 'dependentes', funcionarioId] as const,

  estrutura: ['estrutura'] as const,
  departamentos: ['estrutura', 'departamentos'] as const,
  cargos: ['estrutura', 'cargos'] as const,

  folha: ['folha'] as const,
  folhaDaCompetencia: (competencia: string) => ['folha', 'competencia', competencia] as const,
  meusHolerites: ['folha', 'meus-holerites'] as const,

  dashboard: ['dashboard'] as const,
  resumoDoDashboard: ['dashboard', 'resumo'] as const,

  ponto: ['ponto'] as const,
  pontoDaEmpresa: (consulta: { mes: string; pagina: number; limite: number; busca: string }) => ['ponto', 'empresa', consulta] as const,
  pontoDeHoje: (funcionarioId: number) => ['ponto', 'hoje', funcionarioId] as const,
  historicoDoMes: (funcionarioId: number, mes: string) => ['ponto', 'historico', funcionarioId, mes] as const,
  totaisDoMes: (funcionarioId: number, mes: string) => ['ponto', 'totais', funcionarioId, mes] as const,

  empresa: ['empresa'] as const,

  usuarios: ['usuarios'] as const,
  paginaDeUsuarios: (pagina: number, limite: number) => ['usuarios', 'pagina', pagina, limite] as const,

  perfil: ['perfil'] as const,

  auditoria: ['auditoria'] as const,
  paginaDeAuditoria: (consulta: AuditoriaQuery) => ['auditoria', 'pagina', consulta] as const,
  historicoContratual: (funcionarioId: number) => ['auditoria', 'historico-contratual', funcionarioId] as const,

  // Pedidos de alteração cadastral (nome, e-mail, endereço e banco); não são as solicitações de férias abaixo.
  pedidos: ['pedidos-de-alteracao'] as const,
  paginaDePedidos: (status: StatusDoPedidoApi | null, pagina: number, limite: number) => ['pedidos-de-alteracao', 'pagina', status, pagina, limite] as const,
  meusPedidos: ['pedidos-de-alteracao', 'meus'] as const,

  solicitacoes: ['solicitacoes'] as const,
};
