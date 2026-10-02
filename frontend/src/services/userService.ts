import httpClient from './httpClient';

export interface UserPersonalData {
  id: number;
  nome: string;
  cpf: string | null;
  email: string;
  telefone: string | null;
  data_nascimento: string | null;
  data_admissao: string | null;
  tipo_contrato: string | null;
  status: string;
  endereco: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  nivel: string | null;
  cargo_nome: string | null;
  departamento_nome: string | null;
  avatar?: string; 
}

export const userService = {
  async getMyPersonalData(): Promise<UserPersonalData> {
    return httpClient<UserPersonalData>('/usuarios/perfil', {
      auth: true,
      errorMessage: (data, status) => data?.erro || `Erro ao buscar seus dados (${status}).`
    });
  }
};
