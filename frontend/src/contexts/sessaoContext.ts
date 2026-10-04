import { createContext } from 'react';
import type { User } from '../utils/sessao';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  // Falha ao confirmar a sessão sem que o servidor a tenha recusado (rede, API fora, resposta inválida).
  sessionError: string | null;
  // Aviso para a tela de login quando a sessão foi encerrada pelo servidor.
  sessionNotice: string | null;
  retrySession: () => void;
  login: (email: string, senha: string) => Promise<void>;
  // O aviso, se houver, aparece na tela de login (ex.: a troca de senha encerra a sessão).
  logout: (aviso?: string) => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
