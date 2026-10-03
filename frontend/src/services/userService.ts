import httpClient from './httpClient';
import type { CorpoDeAlterarSenhaApi, CorpoDeMeusDadosApi, MensagemApi, MeusDadosSalvosApi, PerfilApi } from '../types/api';

// Resposta de GET /api/perfil/meus-dados: a mesma forma para todos os perfis. Os campos do
// vínculo com o funcionário vêm null quando `vinculado` é false (ex.: o Administrador).
export type PerfilUsuario = PerfilApi;

export const userService = {
  async getMyProfile(): Promise<PerfilUsuario> {
    return httpClient<PerfilUsuario>('/perfil/meus-dados', {
      auth: true,
      errorMessage: (data, status) => data?.erro || `Erro ao buscar seus dados (${status}).`
    });
  },

  // Telefone e foto (e, para o Administrador, também nome, e-mail, endereço e dados bancários). Trocar o e-mail
  // encerra a sessão: `sessaoEncerrada` avisa a tela.
  async updateMyProfile(dados: CorpoDeMeusDadosApi): Promise<MeusDadosSalvosApi> {
    return httpClient<MeusDadosSalvosApi>('/perfil/meus-dados', {
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
