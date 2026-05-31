// src/AuthContext.tsx

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 1. Definimos a interface do Usuário aqui para não depender do authService do Marcos
export interface User {
  id: string | number;
  nome: string;
  role: string; // O front-end dele espera 'role'
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
    // Quando der F5, o sistema tenta recuperar a sessão
    const recoveredUser = localStorage.getItem('user');
    if (recoveredUser) {
      setUser(JSON.parse(recoveredUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, senha: string) => {
    // 2. Substituímos o authService pela nossa chamada real na API
    const resposta = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.mensagem || dados.erro || 'E-mail ou senha incorretos.');
    }

    // 3. Descodificamos o Token JWT (A mágica que fizemos antes)
    const base64Url = dados.token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));

    // 4. Adaptamos o banco de dados para a linguagem do Front do Marcos
    const usuarioFormatado: User = {
      id: payload.id,
      nome: payload.nome || 'Utilizador',
      role: payload.perfil // O Node envia 'perfil', o Front lê 'role'
    };
    
    // Guardamos tudo no cofre do navegador
    localStorage.setItem('token', dados.token);
    localStorage.setItem('user', JSON.stringify(usuarioFormatado));
    
    // Mantemos os dados soltos para a sua tela de Ponto Eletrônico achar fácil
    localStorage.setItem('nomeUsuario', usuarioFormatado.nome);
    localStorage.setItem('funcionarioId', String(usuarioFormatado.id));
    localStorage.setItem('perfil', usuarioFormatado.role);

    // Atualiza o estado global da aplicação
    setUser(usuarioFormatado);

    // Redirecionamento blindado
    if (usuarioFormatado.role === 'Administrador') {
      navigate('/admin');
    } else {
      navigate('/meu-painel');
    }
  };

  const logout = () => {
    // Limpa a casa na hora de sair[cite: 2]
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