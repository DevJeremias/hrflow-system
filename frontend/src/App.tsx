// src/App.tsx

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

// Importação dos Componentes
import Landing from './components/Landing/Home';
import Login from './components/Auth/Login';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Admin/Dashboard/Dashboard';
import Employees from './components/Admin/Employees/Employees';
import DepartmentsRoles from './components/Admin/DepartmentsRoles/DepartmentsRoles';
import Payroll from './components/Admin/Payroll/Payroll';

// Novo componente do Portal
import EmployeeHome from './components/Portal/EmployeeHome/EmployeeHome'; 
import Payslips from './components/Portal/Payslips/Payslips';
import Requests from './components/Portal/Request/Requests';

// Proteção de Rota com verificação de Perfil
const ProtectedRoute = ({ children, allowedRole }: { children: React.ReactNode, allowedRole?: string }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  if (allowedRole && user?.role !== allowedRole) {
    // Se tentar aceder a algo que não deve, volta para o seu início
    return <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/portal'} replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      {/* ÁREA DO ADMINISTRADOR */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute allowedRole="ADMIN">
            <Layout /> 
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="colaboradores" element={<Employees />} />
        <Route path="estrutura" element={<DepartmentsRoles />} />
        <Route path="folha" element={<Payroll />} />
      </Route>

      {/* ÁREA DO COLABORADOR (NOVO) */}
      <Route 
        path="/portal" 
        element={
          <ProtectedRoute allowedRole="USER">
            <Layout /> 
          </ProtectedRoute>
        }
      >
        <Route index element={<EmployeeHome />} />
        <Route path="holerites" element={<Payslips />} />
        <Route path="solicitacoes" element={<Requests />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;