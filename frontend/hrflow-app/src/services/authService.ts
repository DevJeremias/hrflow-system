// src/services/authService.ts

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export const authService = {
  
  // Função que simula o login (recebe e-mail e senha, retorna uma Promise com os dados)
  async login(email: string, password: string): Promise<AuthResponse> {
    return new Promise((resolve, reject) => {
      
      // Simulando um tempo de carregamento da internet (1.5 segundos)
      setTimeout(() => {
        // Validação mockada
        if (email === 'marcos@hrflow.com' && password === '123456') {
          resolve({
            token: 'mock-jwt-token-987654321',
            user: {
              id: '1',
              name: 'Marcos Brigida',
              email: 'marcos@hrflow.com',
            }
          });
        } else {
          // Se errar a senha, rejeitamos a promessa
          reject(new Error('Credenciais inválidas'));
        }
      }, 1500); 

    });
  }

};