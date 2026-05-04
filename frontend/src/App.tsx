import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Home from './components/Home/Home';
import Login from './components/Login/Login';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import Employees from './components/Employees/Employees';
import DepartmentsRoles from './components/DepartmentsRoles/DepartmentsRoles';
import Payroll from './components/Payroll/Payroll';


const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />

      {/* Rota Pai Protegida */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute>
            <Layout /> 
          </ProtectedRoute>
        }
      >
        {/* Rotas Filhas: Elas aparecerão dentro do Outlet do Layout */}
        <Route index element={<Dashboard />} />
        <Route path="colaboradores" element={<Employees />} />
        <Route path="estrutura" element={<DepartmentsRoles />} />
        <Route path="folha" element={<Payroll />} />
      </Route>
    </Routes>
  );
}

export default App;