import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import Home from './components/Home/Home';
import Dashboard from './components/Dashboard/Dashboard'; 
import Employees from './components/Employees/Employees'; 
import Login from './components/Login/Login'; // Vamos criar este cara no próximo passo

// nosso guarda-costas: verifica se o token existe no cofre
const RotaProtegida = ({ children }) => {
  const token = localStorage.getItem('token');
  
  // se não tem token, chuta o usuário de volta pro login
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// configurando o mapa de rotas
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
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);