// frontend/src/services/employeeService.ts

export interface Employee {
  id: string;
  nomeCompleto: string;
  emailPessoal: string;
  telefone: string;
  cpf: string;
  cargo: string;
  departamento: string;
  status: string;
  dataAdmissao: string;
  avatar?: string;
  
  // Dados Pessoais
  dataNascimento?: string;
  enderecoCompleto?: string;
  
  // Dados Bancários
  banco?: string;
  agencia?: string;
  conta?: string;
  tipoConta?: string;
  
  // Dados de Contrato
  nivel?: string;
  tipoContrato?: string;
  salarioBase?: string | number;
}

const API_URL = 'http://localhost:3000/api/funcionarios';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const employeeService = {
  getAll: async (): Promise<Employee[]> => {
    const res = await fetch(API_URL, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Erro ao buscar colaboradores');
    const data = await res.json();
    
    return data.map((d: any) => ({
      id: d.id?.toString() || '',
      nomeCompleto: d.nome || '',
      emailPessoal: d.email || '',
      telefone: d.telefone || '',
      cpf: d.cpf || '',
      cargo: d.cargo_nome || d.cargo_id?.toString() || 'Não definido', 
      departamento: d.departamento_nome || d.departamento_id?.toString() || 'Não definido',
      status: d.status || 'Ativo',
      dataAdmissao: d.data_admissao ? d.data_admissao.split('T')[0] : '',
      
      dataNascimento: d.data_nascimento ? d.data_nascimento.split('T')[0] : '',
      enderecoCompleto: d.endereco || '',
      
      banco: d.banco || '',
      agencia: d.agencia || '',
      conta: d.conta || '',
      tipoConta: d.tipo_conta || '',
      
      // Lendo os dados de contrato do banco
      nivel: d.nivel || '',
      tipoContrato: d.tipo_contrato || 'CLT',
      salarioBase: d.salario_base || ''
    }));
  },

  save: async (data: any): Promise<void> => {
    const headers = getAuthHeaders();
    
    const [deptsRes, rolesRes] = await Promise.all([
      fetch('http://localhost:3000/api/estrutura/departamentos', { headers }),
      fetch('http://localhost:3000/api/estrutura/cargos', { headers })
    ]);
    
    const depts = await deptsRes.json();
    const roles = await rolesRes.json();
    
    const deptFound = depts.find((d: any) => d.nome === data.departamento);
    const roleFound = roles.find((r: any) => r.nome === data.cargo);

    // Adicionando os campos de contrato e a senha no envio para a API
    const payload = {
      nome: data.nomeCompleto,
      cpf: data.cpf,
      email: data.emailPessoal,
      telefone: data.telefone,
      data_admissao: data.dataAdmissao,
      data_nascimento: data.dataNascimento,
      endereco: data.enderecoCompleto,
      banco: data.banco,
      agencia: data.agencia,
      conta: data.conta,
      tipo_conta: data.tipoConta,
      nivel: data.nivel,
      tipo_contrato: data.tipoContrato,
      salario_base: data.salarioBase,
      cargo_id: roleFound ? roleFound.id : null,
      departamento_id: deptFound ? deptFound.id : null,
      status: data.status || 'Ativo',
      senha: data.senha // Necessário para a criação do login
    };

    const url = data.id ? `${API_URL}/${data.id}` : API_URL;
    const res = await fetch(url, {
      method: data.id ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.erro || 'Erro ao salvar colaborador');
    }
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Erro ao excluir colaborador');
  }
};