import httpClient from './httpClient';
import type { Perfil } from '../utils/sessao';

// Conta de acesso como GET /api/usuarios a devolve.
export interface AccessUser {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  // Presente quando a conta é de quem tem cadastro de funcionário.
  funcionarioId: number | null;
  funcionarioStatus: string | null;
  // A pessoa ainda não trocou a senha que recebeu.
  senhaProvisoria: boolean;
}

export interface UserPage {
  users: AccessUser[];
  total: number;
}

// Só RH e Administrador nascem por aqui: o Colaborador nasce com o cadastro do funcionário.
export type NewUserProfile = 'RH' | 'Administrador';

export interface NewUser {
  nome: string;
  email: string;
  perfil: NewUserProfile;
}

export interface UserChange {
  perfil?: Perfil;
  redefinirSenha?: boolean;
}

// A senha provisória só vem na resposta de quem criou ou redefiniu a conta: não há como lê-la depois.
export interface UserWithPassword {
  user: AccessUser;
  senhaProvisoria?: string;
}

const API_URL = '/usuarios';

// Formas da API (backend/modules/usuarios).
interface ApiUser {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  funcionario_id: number | null;
  funcionario_status: string | null;
  senha_provisoria: number;
}

interface ApiUserWithPassword {
  usuario: ApiUser;
  senha_provisoria?: string;
}

const mapUser = (d: ApiUser): AccessUser => ({
  id: d.id,
  nome: d.nome,
  email: d.email,
  perfil: d.perfil,
  funcionarioId: d.funcionario_id ?? null,
  funcionarioStatus: d.funcionario_status ?? null,
  senhaProvisoria: Boolean(d.senha_provisoria),
});

const mapWithPassword = (d: ApiUserWithPassword): UserWithPassword => ({
  user: mapUser(d.usuario),
  senhaProvisoria: d.senha_provisoria,
});

export const usersService = {
  getPage: async (pagina: number, limite: number): Promise<UserPage> => {
    let total = 0;
    const data = await httpClient<ApiUser[]>(`${API_URL}?pagina=${pagina}&limite=${limite}`, {
      auth: true,
      errorMessage: (err) => err?.erro || 'Erro ao buscar usuários',
      onResponse: (response) => {
        const header = response.headers.get('X-Total-Count');
        if (header === null || !/^\d+$/.test(header)) throw new Error('Resposta da API sem total válido de usuários');
        total = Number(header);
      }
    });
    return { users: data.map(mapUser), total };
  },

  create: async (user: NewUser): Promise<UserWithPassword> => {
    const data = await httpClient<ApiUserWithPassword>(API_URL, {
      method: 'POST',
      auth: true,
      body: JSON.stringify(user),
      errorMessage: (err) => err?.erro || 'Erro ao criar usuário'
    });
    return mapWithPassword(data);
  },

  update: async (id: number, change: UserChange): Promise<UserWithPassword> => {
    const data = await httpClient<ApiUserWithPassword>(`${API_URL}/${id}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify({ perfil: change.perfil, redefinir_senha: change.redefinirSenha }),
      errorMessage: (err) => err?.erro || 'Erro ao alterar usuário'
    });
    return mapWithPassword(data);
  }
};
