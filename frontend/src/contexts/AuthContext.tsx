import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import httpClient, {
  HttpError,
  clearAuthToken,
  getAuthToken,
  setAuthToken,
  setSessionExpiredHandler,
} from '../services/httpClient';
import { User, lerSessao, rotaInicial } from '../utils/sessao';

export type { User };

// Chaves de versões anteriores, que guardavam a identidade no navegador. Nada mais as lê: a
// identidade vem de GET /api/auth/sessao. São apagadas para não restar um perfil forjável.
const CHAVES_LEGADAS = ['user', 'nomeUsuario', 'funcionarioId', 'perfil'];

const AVISO_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente para continuar.';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  // Falha ao confirmar a sessão sem que o servidor a tenha recusado (rede, API fora, resposta inválida).
  sessionError: string | null;
  // Aviso para a tela de login quando a sessão foi encerrada pelo servidor.
  sessionNotice: string | null;
  retrySession: () => void;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  // Sem token não há o que confirmar: as páginas públicas abrem sem esperar o servidor.
  const [loading, setLoading] = useState(() => getAuthToken() !== null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const clearSession = useCallback(() => {
    clearAuthToken();
    setUser(null);
    setSessionError(null);
    queryClient.clear();
  }, [queryClient]);

  const fetchSession = useCallback(async (): Promise<User> => {
    const sessao = lerSessao(await httpClient('/auth/sessao', { auth: true }));
    if (!sessao) throw new Error('O servidor devolveu uma sessão inválida.');
    return sessao;
  }, []);

  // O ProtectedRoute leva ao login quando o usuário some do estado; aqui só se encerra a sessão.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearSession();
      setSessionNotice(AVISO_SESSAO_EXPIRADA);
    });
    return () => setSessionExpiredHandler(null);
  }, [clearSession]);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setSessionError(null);
    try {
      setUser(await fetchSession());
    } catch (error) {
      // 401: o handler central já encerrou a sessão.
      if (!(error instanceof HttpError && error.status === 401)) {
        setSessionError(error instanceof Error ? error.message : 'Não foi possível confirmar a sua sessão.');
      }
    } finally {
      setLoading(false);
    }
  }, [fetchSession]);

  useEffect(() => {
    CHAVES_LEGADAS.forEach((chave) => localStorage.removeItem(chave));
    if (getAuthToken() !== null) loadSession();
  }, [loadSession]);

  const login = async (email: string, senha: string) => {
    const dados = await httpClient<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
      errorMessage: (data) => data?.mensagem || data?.erro || 'E-mail ou senha incorretos.'
    });

    setAuthToken(dados.token);
    try {
      const logged = await fetchSession();
      setSessionNotice(null);
      setUser(logged);
      navigate(rotaInicial(logged.role));
    } catch (error) {
      clearSession();
      throw error;
    }
  };

  const updateUser = (data: Partial<User>) => {
    setUser((atual) => (atual ? { ...atual, ...data } : atual));
  };

  const logout = () => {
    clearSession();
    setSessionNotice(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{
      user, loading, isAuthenticated: !!user, sessionError, sessionNotice,
      retrySession: loadSession, login, logout, updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};
