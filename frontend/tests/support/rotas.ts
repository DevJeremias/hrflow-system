// As telas do App carregam por import dinâmico. Carregá-las antes no servidor do Vite deixa o
// import do React.lazy resolver em microtarefas: o teste não depende da velocidade do primeiro
// carregamento de cada módulo.
import type { ViteDevServer } from 'vite';

const TELAS = [
  'layouts/Layout', 'pages/Landing/Home', 'pages/Auth/Login', 'pages/Auth/TrocarSenha', 'pages/Legal/Termos', 'pages/Legal/Privacidade',
  'pages/Admin/Dashboard', 'pages/Admin/Employees', 'pages/Admin/OrgStructure', 'pages/Admin/Payroll', 'pages/Admin/Users', 'pages/Admin/Company', 'pages/Admin/TimeTracking',
  'pages/Portal/EmployeeDashboard', 'pages/Portal/Payslips', 'pages/Portal/Requests', 'pages/Portal/Profile',
];

export const precarregarTelas = async (server: ViteDevServer): Promise<void> => {
  for (const tela of TELAS) await server.ssrLoadModule(`/src/${tela}.tsx`);
};
