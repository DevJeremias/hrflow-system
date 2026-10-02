import httpClient from './httpClient';
import type { Perfil } from '../utils/sessao';

// Resposta de GET /api/perfil/meus-dados: a mesma forma para todos os perfis. Os campos do
// vínculo com o funcionário vêm null quando `vinculado` é false (ex.: o Administrador).
export interface PerfilUsuario {
  perfil: Perfil;
  vinculado: boolean;
  nome: string;
  email: string;
  avatar: string | null;
  telefone: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  data_admissao: string | null;
  endereco: string | null;
  tipo_contrato: string | null;
  nivel: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  cargo: string | null;
  departamento: string | null;
}

export interface DadosEditaveis {
  nome: string;
  email: string;
  telefone: string;
  avatar: string;
}

export const userService = {
  async getMyProfile(): Promise<PerfilUsuario> {
    return httpClient<PerfilUsuario>('/perfil/meus-dados', {
      auth: true,
      errorMessage: (data, status) => data?.erro || `Erro ao buscar seus dados (${status}).`
    });
  },

  async updateMyProfile(dados: DadosEditaveis): Promise<void> {
    await httpClient('/perfil/meus-dados', {
      method: 'PUT',
      auth: true,
      body: JSON.stringify(dados),
      errorMessage: (data) => data?.erro || 'Erro ao atualizar dados'
    });
  },

  async changeMyPassword(senhaAtual: string, novaSenha: string): Promise<string> {
    const data = await httpClient<{ mensagem?: string }>('/perfil/alterar-senha', {
      method: 'PUT',
      auth: true,
      body: JSON.stringify({ senhaAtual, novaSenha }),
      errorMessage: (data) => data?.erro || 'Erro ao alterar senha'
    });
    return data.mensagem || 'Senha atualizada com sucesso!';
  }
};
