import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

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

const ProtectedRoute = ({ children, allowedRole }: { children: React.ReactNode, allowedRole?: string }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  if (allowedRole && user?.role !== allowedRole) {
    return <Navigate to={user?.role === 'Administrador' ? '/admin' : '/meu-painel'} replace />;
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
          <ProtectedRoute allowedRole="Administrador">
            <Layout /> 
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="colaboradores" element={<Employees />} />
        <Route path="estrutura" element={<DepartmentsRoles />} />
        <Route path="folha" element={<Payroll />} />
        <Route path="gestao-ponto" element={<TimeTracking />} /> {/* ROTA OFICIALIZADA */}
      </Route>

      {/* ÁREA DO COLABORADOR */}
      <Route 
        path="/meu-painel" 
        element={
          <ProtectedRoute allowedRole="Colaborador">
            <Layout /> 
          </ProtectedRoute>
        }
      >
        <Route index element={<EmployeeHome />} />
        <Route path="holerites" element={<Payslips />} />
        <Route path="solicitacoes" element={<Requests />} />
        <Route path="perfil" element={<Profile />} />
      </Route>

      {/* Fallback para qualquer rota não existente */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;