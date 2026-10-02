import httpClient from './httpClient';

// Reparou? Apagámos a linha do "import { api }" porque não precisamos dela!

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
    try {
      // 1. Faz o pedido direto ao seu backend na porta 3000 usando o fetch nativo
      const response = await httpClient('/usuarios/perfil', {
        method: 'GET',
        auth: true,
        errorMessage: (data, status) => `Erro na requisição: ${status}`
      });

      // 2. Verifica se o backend devolveu algum erro (ex: 401 ou 404)
      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      // 3. Converte a resposta do backend para JSON e devolve para o ecrã MyProfile
      const data = await response.json();
      return data;
      
    } catch (error) {
      console.error("Erro ao procurar dados pessoais:", error);
      throw error;
    }
  }
};