import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

// Importação das páginas
import Home from './components/Home/Home';
import Login from './components/Login/Login';
import Register from './components/Register/Register'; // A nossa tela nova aqui!
import Dashboard from './components/Dashboard/Dashboard';
import Employees from './components/Employees/Employees';
import EmConstrucao from './components/EmConstrucao/EmConstrucao';

// Nosso segurança de rotas
const RotaProtegida = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Configuração de todas as rotas do sistema
const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/registro",
    element: <Register />,
  },
  {
    path: "/admin",
    element: (
      <RotaProtegida>
        <Dashboard />
      </RotaProtegida>
    ),
  },
  {
    path: "/admin/colaboradores",
    element: (
      <RotaProtegida>
        <Employees />
      </RotaProtegida>
    ),
  },
  {
    path: "/admin/folha-pagamento",
    element: (
      <RotaProtegida>
        <EmConstrucao />
      </RotaProtegida>
    ),
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);