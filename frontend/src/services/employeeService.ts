import httpClient from './httpClient.ts';

// frontend/src/services/employeeService.ts

export interface Employee {
  id: string;
  nomeCompleto: string;
  emailPessoal: string;
  telefone: string;
  cpf: string;
  cargo: string;
  cargoId?: string;
  departamento: string;
  departamentoId?: string;
  status: string;
  dataAdmissao: string;
  avatar?: string;
  // Perfil da conta de acesso (RH e Administrador não são alterados pelo RH); vazio sem conta.
  perfilAcesso?: string;
  
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

// Estado do formulário do colaborador: os campos de Employee, mais os que só existem no cadastro.
export type EmployeeForm = Record<string, string>;

const API_URL = '/funcionarios';

export interface EmployeePage {
  employees: Employee[];
  total: number;
}

const mapEmployee = (d: any): Employee => ({
  id: d.id?.toString() || '',
  nomeCompleto: d.nome || '',
  emailPessoal: d.email || '',
  telefone: d.telefone || '',
  cpf: d.cpf || '',
  cargo: d.cargo_nome || d.cargo_id?.toString() || 'Não definido',
  cargoId: d.cargo_id?.toString() || '',
  departamento: d.departamento_nome || d.departamento_id?.toString() || 'Não definido',
  departamentoId: d.departamento_id?.toString() || '',
  status: d.status || 'Ativo',
  perfilAcesso: d.perfil_acesso || '',
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
});

export const employeeService = {
  getPage: async (pagina: number, limite: number): Promise<EmployeePage> => {
    let total = 0;
    const data = await httpClient<any[]>(`${API_URL}?pagina=${pagina}&limite=${limite}`, {
      auth: true,
      errorMessage: 'Erro ao buscar colaboradores',
      onResponse: (response) => {
        const header = response.headers.get('X-Total-Count');
        if (header === null || !/^\d+$/.test(header)) throw new Error('Resposta da API sem total válido de colaboradores');
        total = Number(header);
      }
    });

    return { employees: data.map(mapEmployee), total };
  },

  save: async (data: EmployeeForm): Promise<void> => {
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
      cargo_id: data.cargoId ? Number(data.cargoId) : null,
      departamento_id: data.departamentoId ? Number(data.departamentoId) : null,
      status: data.status || 'Ativo',
      // A API só usa a senha no cadastro; na edição o campo nem é exibido.
      ...(data.id ? {} : { senha: data.senhaAcesso })
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