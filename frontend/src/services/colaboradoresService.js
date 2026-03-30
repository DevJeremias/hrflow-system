const API_URL = 'http://localhost:3000/api';

// busca a malta no banco
export const buscarColaboradores = async () => {
  const token = localStorage.getItem('token');

  try {
    const resposta = await fetch(`${API_URL}/funcionarios`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!resposta.ok) throw new Error('Falha ao buscar dados');
    
    const dadosDoBanco = await resposta.json();

    return dadosDoBanco.map(func => ({
      id: func.id,
      nomeCompleto: func.nome,
      emailPessoal: func.email,
      cpf: func.cpf || '',
      telefone: func.telefone || '',
      cargo: func.cargo || 'Não definido', 
      cargo_id: func.cargo_id || '', // AGORA LÊ O ID DO CARGO
      departamento: func.departamento || 'Não definido',
      departamento_id: func.departamento_id || '', // AGORA LÊ O ID DO DEPARTAMENTO
      status: func.status || 'Ativo',
    }));

  } catch (erro) {
    console.error("Erro na busca:", erro);
    return []; 
  }
};

export const salvarColaborador = async (dadosDaTela) => {
  const token = localStorage.getItem('token');

  const payloadParaOBanco = {
    nome: dadosDaTela.nomeCompleto,
    cpf: dadosDaTela.cpf,
    email: dadosDaTela.emailPessoal,
    telefone: dadosDaTela.telefone || '',
    data_admissao: dadosDaTela.dataAdmissao || new Date().toISOString().split('T')[0], 
    
    // Agora envia o ID real que o utilizador escolheu no ecrã!
    cargo_id: dadosDaTela.cargo_id || 1, 
    departamento_id: dadosDaTela.departamento_id || 1,
    status: 'Ativo'
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
      throw new Error(erroServidor.erro || 'Erro ao salvar no servidor');
    }

    return await resposta.json();
  } catch (erro) {
    console.error("Erro ao salvar:", erro);
    throw erro; 
  }
};

export const excluirColaborador = async (id) => {
  const token = localStorage.getItem('token');
  try {
    const resposta = await fetch(`${API_URL}/funcionarios/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resposta.ok) throw new Error('Erro ao excluir no servidor');
    return true; 
  } catch (erro) {
    console.error("Erro ao excluir:", erro);
    throw erro;
  }
};

// NOVAS FUNÇÕES: Buscar Cargos e Departamentos
export const buscarCargos = async () => {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/cargos`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) return await res.json();
    throw new Error('Rota não encontrada');
  } catch (erro) {
    // Fallback: se o teu Back-end não tiver a rota, usamos estes provisórios
    return [
      { id: 1, nome: 'Analista de Sistemas' },
      { id: 2, nome: 'Gestor de Projetos' },
      { id: 3, nome: 'Designer UX/UI' },
      { id: 4, nome: 'Desenvolvedor Full-Stack' }
    ];
  }
};

export const buscarDepartamentos = async () => {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/departamentos`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) return await res.json();
    throw new Error('Rota não encontrada');
  } catch (erro) {
    // Fallback provisório
    return [
      { id: 1, nome: 'Tecnologia da Informação (TI)' },
      { id: 2, nome: 'Recursos Humanos (RH)' },
      { id: 3, nome: 'Financeiro' },
      { id: 4, nome: 'Marketing' }
    ];
  }
};