// src/AuthContext.tsx

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export interface User {
  id: string | number;
  nome: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const recoveredUser = localStorage.getItem('user');
    if (recoveredUser) {
      setUser(JSON.parse(recoveredUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, senha: string) => {
    const resposta = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.mensagem || dados.erro || 'E-mail ou senha incorretos.');
    }

    // A mágica moderna para decodificar JWT com UTF-8 (resolve o bug do JoÃ£o)
    const base64Url = dados.token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const binString = window.atob(base64);
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
        bytes[i] = binString.charCodeAt(i);
    }
    const payload = JSON.parse(new TextDecoder().decode(bytes));

    const usuarioFormatado: User = {
      id: payload.id,
      nome: payload.nome || 'Utilizador',
      role: payload.perfil 
    };
    
    localStorage.setItem('token', dados.token);
    localStorage.setItem('user', JSON.stringify(usuarioFormatado));
    
    localStorage.setItem('nomeUsuario', usuarioFormatado.nome);
    localStorage.setItem('funcionarioId', String(usuarioFormatado.id));
    localStorage.setItem('perfil', usuarioFormatado.role);

    setUser(usuarioFormatado);

    if (usuarioFormatado.role === 'Administrador') {
      navigate('/admin');
    } else {
      navigate('/meu-painel');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('nomeUsuario');
    localStorage.removeItem('funcionarioId');
    localStorage.removeItem('perfil');
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};