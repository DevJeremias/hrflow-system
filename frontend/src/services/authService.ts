export interface User {
  name: string;
  email: string;
  role: string;
}

export const authService = {
  login: async (email: string, senha: string): Promise<{ user: User, token: string }> => {
    // Simula a lentidão da internet (1 segundo)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Validação estática
    if (email === 'admin@gmail.com' && senha === '123456') {
      return {
        user: { name: 'Marcos Brigida', email, role: 'ADMIN' },
        token: 'token-jwt-simulado-aqui'
      };
    }
    
    throw new Error('Credenciais inválidas. Use admin@gmail.com e 123456.');
  }
};