// src/services/colaboradoresService.js

// Um "banco de dados" falso na memória para você testar a tela
// Arquivo: src/services/colaboradoresService.js

let bancoMock = [
  { 
    id: 1, 
    nomeCompleto: 'Jeremias Branco', 
    emailPessoal: 'jeremias.branco@email.com', 
    telefone: '(11) 98765-4321',
    cpf: '123.456.789-00', 
    dataNascimento: '1990-05-15',
    enderecoCompleto: 'Rua das Flores, 123, São Paulo - SP',
    matricula: 'COL001',
    cargo: 'Gerente de Projetos', 
    departamento: 'TI',
    dataAdmissao: '2020-01-14',
    tipoContrato: 'CLT',
    salarioBase: '8500.00',
    // Avatar falso usando o Pravatar para ficar com foto na tela
    avatar: 'https://i.pravatar.cc/150?u=anasilva' 
  }
];


// O Front-end chama isso para pegar os dados
export const buscarColaboradores = async () => {
  // Simulando lentidão de internet (meio segundo)
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([...bancoMock]);
    }, 500);
  });
};

// O Front-end chama isso para Salvar (Criar ou Editar)
export const salvarColaborador = async (dados) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (dados.id) {
        // É uma edição
        bancoMock = bancoMock.map(colab => colab.id === dados.id ? dados : colab);
        resolve(dados);
      } else {
        // É um cadastro novo
        const novoRegistro = { ...dados, id: Date.now() };
        bancoMock.push(novoRegistro);
        resolve(novoRegistro);
      }
    }, 500);
  });
};