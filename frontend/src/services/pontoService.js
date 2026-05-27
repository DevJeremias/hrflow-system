const API_URL = 'http://localhost:3000/api/pontos';

// Função para enviar as coordenadas e registar o ponto no Back-end
export const registarPontoAPI = async (dadosPonto) => {
  const token = localStorage.getItem('token');

  if (!token) {
    throw new Error('Utilizador não autenticado. Faça login novamente.');
  }

  try {
    const resposta = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dadosPonto)
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || 'Falha ao registar o ponto no servidor.');
    }

    return dados;
  } catch (erro) {
    console.error("Erro no serviço de ponto:", erro);
    throw erro; 
  }
};

// Função para buscar o histórico de pontos (usaremos isto no painel depois)
export const buscarHistoricoPontos = async () => {
  const token = localStorage.getItem('token');

  try {
    const resposta = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!resposta.ok) {
      throw new Error('Falha ao buscar o histórico de pontos.');
    }

    return await resposta.json();
  } catch (erro) {
    console.error("Erro ao buscar histórico:", erro);
    return []; 
  }
};