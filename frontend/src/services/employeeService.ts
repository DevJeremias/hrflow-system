import httpClient from './httpClient';

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
  
  dataNascimento?: string;
  enderecoCompleto?: string;
  
  banco?: string;
  agencia?: string;
  conta?: string;
  tipoConta?: string;
  
  nivel?: string;
  tipoContrato?: string;
  salarioBase?: string | number;
}

const API_URL = '/funcionarios';

export const employeeService = {
  getAll: async (): Promise<Employee[]> => {
    const data = await httpClient<any[]>(API_URL, { auth: true, errorMessage: 'Erro ao buscar colaboradores' });
    
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
      
      nivel: d.nivel || '',
      tipoContrato: d.tipo_contrato || 'CLT',
      salarioBase: d.salario_base || ''
    }));
  },

  save: async (data: any): Promise<void> => {
    const [deptsRes, rolesRes] = await Promise.all([
      httpClient('/estrutura/departamentos', { auth: true }),
      httpClient('/estrutura/cargos', { auth: true })
    ]);
    
    const depts = deptsRes;
    const roles = rolesRes;
    
    const deptFound = depts.find((d: any) => d.nome === data.departamento || d.sigla === data.departamento);
    const roleFound = roles.find((r: any) => r.nome === data.cargo);

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
      senha: data.senhaAcesso // Mapeia exatamente o nome do seu campo em PersonalTab
    };

    const url = data.id ? `${API_URL}/${data.id}` : API_URL;
    await httpClient(url, {
      method: data.id ? 'PUT' : 'POST',
      auth: true,
      body: JSON.stringify(payload),
      errorMessage: (err) => err?.erro || 'Erro ao salvar colaborador'
    });
  },

  delete: async (id: string): Promise<void> => {
    await httpClient(`${API_URL}/${id}`, {
      method: 'DELETE',
      auth: true,
      errorMessage: (err) => err?.erro || 'Erro ao excluir colaborador'
    });
  }
};