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
}

export const userService = {
  async getMyPersonalData(): Promise<UserPersonalData> {
    try {
      // 1. Vai buscar o Token que o seu sistema guardou quando fez o login
      // (Se você guardou com outro nome no seu frontend, basta alterar a palavra 'token' aqui)
      const token = localStorage.getItem('token'); 

      // 2. Faz o pedido direto ao seu backend na porta 3000 usando o fetch nativo
      const response = await fetch('http://localhost:3000/api/usuarios/perfil', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Entrega o "crachá" ao backend
        }
      });

      // 3. Verifica se o backend devolveu algum erro (ex: 401 ou 404)
      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      // 4. Converte a resposta do backend para JSON e devolve para o ecrã MyProfile
      const data = await response.json();
      return data;
      
    } catch (error) {
      console.error("Erro ao procurar dados pessoais:", error);
      throw error;
    }
  }
};