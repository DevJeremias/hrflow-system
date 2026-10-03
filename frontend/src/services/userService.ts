import httpClient from './httpClient';
import type { CorpoDeAlterarSenhaApi, CorpoDeMeusDadosApi, MensagemApi, PerfilApi } from '../types/api';

// Resposta de GET /api/perfil/meus-dados: a mesma forma para todos os perfis. Os campos do
// vínculo com o funcionário vêm null quando `vinculado` é false (ex.: o Administrador).
export type PerfilUsuario = PerfilApi;

// O que a aba de dados edita. `avatar` é o endereço da foto atual, '' (sem foto) ou um data URL novo.
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

  async updateMyProfile(dados: CorpoDeMeusDadosApi): Promise<void> {
    await httpClient('/perfil/meus-dados', {
      method: 'PUT',
      auth: true,
      body: JSON.stringify(dados),
      errorMessage: (data) => data?.erro || 'Erro ao atualizar dados'
    });
  },

  async changeMyPassword(senhaAtual: string, novaSenha: string): Promise<string> {
    const corpo: CorpoDeAlterarSenhaApi = { senhaAtual, novaSenha };
    const data = await httpClient<Partial<MensagemApi>>('/perfil/alterar-senha', {
      method: 'PUT',
      auth: true,
      body: JSON.stringify(corpo),
      errorMessage: (data) => data?.erro || 'Erro ao alterar senha'
    });
    return data.mensagem || 'Senha atualizada com sucesso!';
  }
};
