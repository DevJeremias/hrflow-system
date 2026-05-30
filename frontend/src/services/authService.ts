export interface User {
  name: string;
  email: string;
  role: string;
}

export const authService = {
  login: async (email: string, senha: string): Promise<{ user: User, token: string }> => {
    // Simula a latência da rede (1 segundo)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulação de Admin
    if (email === 'admin@gmail.com' && senha === '123456') {
      return {
        user: { 
          name: 'Marcos Brigida', 
          email, 
          role: 'ADMIN' 
        },
        token: 'token-admin-jwt-simulado'
      };
    }
    
    // Simulação de Colaborador (User) - NOVO
    if (email === 'user@gmail.com' && senha === '123456') {
      return {
        user: { 
          name: 'João Silva', 
          email, 
          role: 'USER' 
        },
        token: 'token-user-jwt-simulado'
      };
    }
    
    throw new Error('Credenciais inválidas. Tente admin@gmail.com ou user@gmail.com com a senha 123456.');
  }
};