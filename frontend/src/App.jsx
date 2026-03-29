import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Importe as telas que seus colegas criaram (ajuste os caminhos se precisar)
import Home from './pages/Home'; 
import Login from './pages/Login'; 
import Employees from './components/Employees/Employees'; // A tela que você me mandou
// import AdminLayout from './components/Layout/Layout'; // Se eles tiverem um layout

// O nosso Guarda-Costas: Só deixa entrar se tiver o Token no cofre
const RotaPrivada = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota Pública: A página inicial */}
        <Route path="/" element={<Home />} />
        
        {/* Rota Pública: A página de Login */}
        <Route path="/login" element={<Login />} />
        
        {/* Rota Privada: O painel só abre com o Token */}
        <Route 
          path="/admin" 
          element={
            <RotaPrivada>
              {/* Seus colegas provavelmente colocaram a Navbar dentro de um Layout. 
                  Coloque aqui o componente principal do seu painel. */}
              <Employees /> 
            </RotaPrivada>
          } 
        />

        {/* Se o usuário digitar uma URL maluca, manda de volta pra Home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}