// src/services/employeeService.ts

export interface Employee {
  id: string;
  // Dados Pessoais
  nomeCompleto: string;
  emailPessoal: string;
  telefone: string;
  cpf: string;
  dataNascimento: string;
  enderecoCompleto: string;
  senhaAcesso?: string;
  
  // Dados Profissionais
  matricula: string;
  cargo: string;
  departamento: string;
  dataAdmissao: string;
  tipoContrato: string;
  salarioBase: string;
  status: 'Ativo' | 'Inativo' | 'Férias';
  avatar?: string;

  // Dados Bancários
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
}

// Simulação de banco de dados local (Mock)
let mockEmployees: Employee[] = [
  {
    id: '1',
    nomeCompleto: 'Marcos Brigida',
    emailPessoal: 'marcos@email.com',
    telefone: '(91) 98888-7777',
    cpf: '123.456.789-00',
    dataNascimento: '2000-05-15',
    enderecoCompleto: 'Rua das Flores, 123, Belém - PA',
    matricula: 'COL001',
    cargo: 'Desenvolvedor Fullstack',
    departamento: 'TI',
    dataAdmissao: '2024-01-10',
    tipoContrato: 'CLT',
    salarioBase: '8500',
    status: 'Ativo',
    avatar: 'https://i.pravatar.cc/150?u=marcos',
    banco: 'Nubank',
    agencia: '0001',
    conta: '1234567-8',
    tipoConta: 'Corrente'
  },
  {
    id: '2',
    nomeCompleto: 'Ana Oliveira',
    emailPessoal: 'ana.rh@email.com',
    telefone: '(91) 91111-2222',
    cpf: '987.654.321-11',
    dataNascimento: '1992-08-20',
    enderecoCompleto: 'Av. Paulista, 500, São Paulo - SP',
    matricula: 'COL002',
    cargo: 'Gerente de RH',
    departamento: 'RH',
    dataAdmissao: '2022-03-15',
    tipoContrato: 'CLT',
    salarioBase: '12000',
    status: 'Ativo',
    avatar: 'https://i.pravatar.cc/150?u=ana',
    banco: 'Itaú',
    agencia: '0450',
    conta: '99887-1',
    tipoConta: 'Corrente'
  }
];

export const employeeService = {
  // Simula a busca de todos os colaboradores (GET)
  getAll: async (): Promise<Employee[]> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return [...mockEmployees];
  },

  // Simula a busca de um colaborador específico por ID
  getById: async (id: string): Promise<Employee | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockEmployees.find(emp => emp.id === id);
  },

  // Simula salvar (Criação ou Edição)
  save: async (data: Partial<Employee>): Promise<Employee> => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (data.id) {
      // Edição: Atualiza o registro existente
      const index = mockEmployees.findIndex(emp => emp.id === data.id);
      if (index === -1) throw new Error('Colaborador não encontrado');
      
      const updatedEmployee = { ...mockEmployees[index], ...data } as Employee;
      mockEmployees[index] = updatedEmployee;
      return updatedEmployee;
    } else {
      // Criação: Adiciona um novo com ID gerado
      const newEmployee: Employee = {
        ...data,
        id: Math.random().toString(36).substr(2, 9),
        avatar: `https://i.pravatar.cc/150?u=${data.nomeCompleto}`,
        status: data.status || 'Ativo'
      } as Employee;
      
      mockEmployees.push(newEmployee);
      return newEmployee;
    }
  },

  // Simula a exclusão (DELETE)
  delete: async (id: string): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = mockEmployees.findIndex(emp => emp.id === id);
    if (index !== -1) {
      mockEmployees.splice(index, 1);
    } else {
      throw new Error('Erro ao excluir: Colaborador não localizado.');
    }
  }
};