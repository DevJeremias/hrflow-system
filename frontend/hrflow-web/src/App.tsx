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

// Proteção de Rota EXCLUSIVA para Administradores
const ProtectedRoute = ({ children, allowedRole }: { children: React.ReactNode, allowedRole?: string }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return null;
  
  // Se não está logado, vai pro login
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  // Se estiver logado mas tentar acessar e não for ADMIN, chuta de volta
  if (allowedRole && user?.role !== allowedRole) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      {/* ÁREA DO ADMINISTRADOR (Agora a única área interna do sistema Web) */}
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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;