// src/services/colaboradoresService.js

const API_URL = 'http://localhost:3000/api';

// 1. BUSCAR COLABORADORES DO SEU MYSQL
export const buscarColaboradores = async () => {
  const token = localStorage.getItem('token'); // Pega o passaporte gerado no login

  try {
    const resposta = await fetch(`${API_URL}/funcionarios`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!resposta.ok) throw new Error('Falha ao buscar dados do servidor');
    
    const dadosDoBanco = await resposta.json();

    // TRADUÇÃO: O que vem do banco (nome) vira o que a tela espera (nomeCompleto)
    return dadosDoBanco.map(func => ({
      id: func.id,
      nomeCompleto: func.nome,
      emailPessoal: func.email,
      senhaAcesso: func.senha,
      cpf: func.cpf || '',
      cargo: func.perfil || 'Colaborador', // Traz o perfil do banco
      status: func.ativo === 1 ? 'Ativo' : 'Inativo',
    }));

  } catch (erro) {
    console.error("Erro no serviço de busca:", erro);
    return []; 
  }
};

// 2. SALVAR NOVO COLABORADOR NO MYSQL
export const salvarColaborador = async (dadosDaTela) => {
  const token = localStorage.getItem('token');

  // TRADUÇÃO: A tela manda "nomeCompleto", nós convertemos para "nome" pro banco aceitar
  const payloadParaOBanco = {
    nome: dadosDaTela.nomeCompleto,
    email: dadosDaTela.emailPessoal,
    senha: dadosDaTela.senhaAcesso || '123456', 
    perfil: 'Colaborador', 
    ativo: 1
  };

  try {
    const url = dadosDaTela.id ? `${API_URL}/funcionarios/${dadosDaTela.id}` : `${API_URL}/funcionarios`;
    const method = dadosDaTela.id ? 'PUT' : 'POST';

    const resposta = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payloadParaOBanco)
    });

    if (!resposta.ok) {
      const erroServidor = await resposta.json();
      throw new Error(erroServidor.mensagem || 'Erro ao salvar no servidor');
    }

    return await resposta.json();

  } catch (erro) {
    console.error("Erro ao salvar:", erro);
    throw erro; // Repassa o erro para a tela exibir um alerta
  }
};