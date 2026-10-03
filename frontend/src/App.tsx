import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Perfil, ROTA_TROCA_DE_SENHA, rotaInicial } from './utils/sessao';
import { solicitacoesAtivas } from './utils/recursos';
import ErrorAlert from './components/ErrorAlert';

import Landing from './pages/Landing/Home';
import Login from './pages/Auth/Login';
import TrocarSenha from './pages/Auth/TrocarSenha';
import Termos from './pages/Legal/Termos';
import Privacidade from './pages/Legal/Privacidade';
import Layout from './layouts/Layout';
import Dashboard from './pages/Admin/Dashboard';
import Employees from './pages/Admin/Employees';
import DepartmentsRoles from './pages/Admin/OrgStructure';
import Payroll from './pages/Admin/Payroll';
import TimeTracking from './pages/Admin/TimeTracking'; // IMPORTAÇÃO DA NOVA PÁGINA

import EmployeeHome from './pages/Portal/EmployeeDashboard'; 
import Payslips from './pages/Portal/Payslips';
import Requests from './pages/Portal/Requests';
import Profile from './pages/Portal/Profile';

// A sessão é confirmada no servidor antes de decidir entre a tela e o login: sem isto a tela ficaria em branco.
const SessionLoading = () => (
  <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
    <p className="text-sm font-bold text-slate-500">Verificando sua sessão...</p>
  </div>
);

// `trocaDeSenha` marca a única rota de quem entrou com senha provisória: ela leva todas as outras
// para si, e quem não tem senha provisória não tem o que fazer nela.
const ProtectedRoute = ({ children, allowedRoles, trocaDeSenha = false }: { children: React.ReactNode, allowedRoles?: readonly Perfil[], trocaDeSenha?: boolean }) => {
  const { isAuthenticated, user, loading, sessionError, retrySession, logout } = useAuth();

  if (loading) return <SessionLoading />;

  // O servidor não recusou a sessão, só não foi possível confirmá-la: não é motivo para deslogar.
  if (sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md space-y-4">
          <ErrorAlert message={sessionError} onRetry={retrySession} />
          <button onClick={() => logout()} className="text-sm font-bold text-slate-500 hover:text-slate-700 underline underline-offset-4">
            Sair e entrar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  if (user.senhaProvisoria && !trocaDeSenha) return <Navigate to={ROTA_TROCA_DE_SENHA} replace />;
  if (!user.senhaProvisoria && trocaDeSenha) return <Navigate to={rotaInicial(user.role)} replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={rotaInicial(user.role)} replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/termos" element={<Termos />} />
      <Route path="/privacidade" element={<Privacidade />} />
      <Route path={ROTA_TROCA_DE_SENHA} element={<ProtectedRoute trocaDeSenha><TrocarSenha /></ProtectedRoute>} />

      <Route 
        path="/admin" 
        element={
          <ProtectedRoute allowedRoles={['Administrador', 'RH']}>
            <Layout /> 
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="colaboradores" element={<Employees />} />
        <Route path="estrutura" element={<DepartmentsRoles />} />
        <Route path="folha" element={<Payroll />} />
        <Route path="gestao-ponto" element={<TimeTracking />} /> {/* ROTA OFICIALIZADA */}
        <Route path="perfil" element={<Profile />} />
      </Route>

      {/* ÁREA DO COLABORADOR */}
      <Route 
        path="/meu-painel" 
        element={
          <ProtectedRoute allowedRoles={['Colaborador']}>
            <Layout /> 
          </ProtectedRoute>
        }
      >
        <Route index element={<EmployeeHome />} />
        <Route path="holerites" element={<Payslips />} />
        <Route path="solicitacoes" element={solicitacoesAtivas() ? <Requests /> : <Navigate to="/meu-painel" replace />} />
        <Route path="perfil" element={<Profile />} />
      </Route>

      {/* Fallback para qualquer rota não existente */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;