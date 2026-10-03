import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Perfil, rotaInicial } from './utils/sessao';
import { solicitacoesAtivas } from './utils/recursos';
import ErrorAlert from './components/ErrorAlert';

import Landing from './pages/Landing/Home';
import Login from './pages/Auth/Login';
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

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: readonly Perfil[] }) => {
  const { isAuthenticated, user, loading, sessionError, retrySession, logout } = useAuth();

  if (loading) return null;

  // O servidor não recusou a sessão, só não foi possível confirmá-la: não é motivo para deslogar.
  if (sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md space-y-4">
          <ErrorAlert message={sessionError} onRetry={retrySession} />
          <button onClick={logout} className="text-sm font-bold text-slate-500 hover:text-slate-700 underline underline-offset-4">
            Sair e entrar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

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