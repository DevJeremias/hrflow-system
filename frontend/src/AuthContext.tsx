import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export interface User {
  id: string | number;
  nome: string;
  role: string;
  avatar?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void; // Função nova
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
      role: payload.perfil,
      avatar: null // O avatar será lido na tela de perfil posteriormente
    };
    
    localStorage.setItem('token', dados.token);
    localStorage.setItem('user', JSON.stringify(usuarioFormatado));
    
    // Mantido da branch main: itens essenciais para o Relógio de Ponto e outros serviços
    localStorage.setItem('nomeUsuario', usuarioFormatado.nome);
    // Usa o funcionario_id do payload (se existir) para garantir a integridade do ponto do colaborador
    localStorage.setItem('funcionarioId', String(payload.funcionario_id || usuarioFormatado.id));
    localStorage.setItem('perfil', usuarioFormatado.role);

    setUser(usuarioFormatado);

    if (usuarioFormatado.role === 'Administrador') {
      navigate('/admin');
    } else {
      navigate('/meu-painel');
    }
  };

  const updateUser = (data: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...data };
      setUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Limpeza das chaves adicionadas pela branch main
    localStorage.removeItem('nomeUsuario');
    localStorage.removeItem('funcionarioId');
    localStorage.removeItem('perfil');
    
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, logout, updateUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};