import httpClient from './httpClient';
import type { MensagemApi } from '../types/api';

// "Esqueci a senha": o pedido manda o e-mail com o link; o link leva o token à tela de redefinição.
export const recuperacaoDeSenhaService = {
  async pedirRedefinicao(email: string): Promise<string> {
    const { mensagem } = await httpClient<MensagemApi>('/auth/esqueci-senha', {
      method: 'POST',
      body: JSON.stringify({ email }),
      errorMessage: (data) => data?.erro || 'Erro ao pedir a redefinição de senha.',
    });
    return mensagem;
  },

  async redefinirSenha(token: string, senha: string): Promise<void> {
    await httpClient('/auth/redefinir-senha', {
      method: 'POST',
      body: JSON.stringify({ token, senha }),
      errorMessage: (data) => data?.erro || 'Erro ao redefinir a senha.',
    });
  },
};
