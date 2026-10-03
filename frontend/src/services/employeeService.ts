import httpClient from './httpClient.ts';
import type {
  ConsultaDeFuncionariosApi, CorpoDeFuncionarioApi, CorpoDeStatusApi, FuncionarioApi, SenhaProvisoriaApi,
} from '../types/api.ts';

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
  // Desligamento: preenchidos só para quem está Inativo.
  dataDesligamento?: string;
  motivoDesligamento?: string;
  // Perfil do acesso vinculado (null: sem acesso). O RH só age sobre Colaborador.
  perfilAcesso?: string | null;
  // Com ponto ou justificativa o cadastro não pode ser excluído, só inativado.
  temMovimento?: boolean;
  
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

const mapEmployee = (d: FuncionarioApi): Employee => ({
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
  dataDesligamento: d.data_desligamento || '',
  motivoDesligamento: d.motivo_desligamento || '',
  perfilAcesso: d.usuario_perfil ?? null,
  temMovimento: Boolean(d.tem_movimento),
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

export type StatusChange =
  | { status: 'Ativo' | 'Férias' }
  | { status: 'Inativo'; date: string; reason: string };

// Os filtros vão ao servidor: a busca enxerga todos os colaboradores, não só a página aberta.
export interface EmployeeQuery {
  pagina: number;
  limite: number;
  busca?: string;
  status?: string;
  departamentoId?: string;
}

const paraConsulta = ({ pagina, limite, busca, status, departamentoId }: EmployeeQuery): ConsultaDeFuncionariosApi => ({
  pagina,
  limite,
  ...(busca ? { busca } : {}),
  ...(status ? { status } : {}),
  ...(departamentoId ? { departamento_id: Number(departamentoId) } : {}),
});

export const employeeService = {
  getPage: async (query: EmployeeQuery): Promise<EmployeePage> => {
    const params = new URLSearchParams(
      Object.entries(paraConsulta(query)).map(([chave, valor]) => [chave, String(valor)])
    );
    let total = 0;
    const data = await httpClient<FuncionarioApi[]>(`${API_URL}?${params}`, {
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
    const payload: CorpoDeFuncionarioApi = {
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

  // Os dados vão por PUT; a situação (Férias, Inativo com data e motivo) só muda por PATCH, e só
  // quando o formulário a alterou.
  saveEditingStatus: async (data: EmployeeForm, original: Employee | null): Promise<void> => {
    await employeeService.save(data);
    if (!original) return;
    const { status = 'Ativo', dataDesligamento = '', motivoDesligamento = '' } = data;
    const changed = status !== original.status
      || (status === 'Inativo' && (dataDesligamento !== original.dataDesligamento || motivoDesligamento !== original.motivoDesligamento));
    if (!changed) return;
    await employeeService.changeStatus(original.id, status === 'Inativo'
      ? { status, date: dataDesligamento, reason: motivoDesligamento.trim() }
      : { status: status as 'Ativo' | 'Férias' });
  },

  // Inativar é desligar: a API exige data e motivo e encerra as sessões da pessoa. Os demais
  // status limpam os dois campos.
  changeStatus: async (id: string, change: StatusChange): Promise<void> => {
    await httpClient(`${API_URL}/${id}/status`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify((change.status === 'Inativo'
        ? { status: change.status, data_desligamento: change.date, motivo_desligamento: change.reason }
        : { status: change.status }) satisfies CorpoDeStatusApi),
      errorMessage: (err) => err?.erro || 'Erro ao alterar a situação do colaborador'
    });
  },

  // Devolve a senha provisória, que a API mostra uma única vez.
  resetPassword: async (id: string): Promise<string> => {
    const data = await httpClient<SenhaProvisoriaApi>(`${API_URL}/${id}/redefinir-senha`, {
      method: 'POST',
      auth: true,
      errorMessage: (err) => err?.erro || 'Erro ao redefinir a senha'
    });
    return data.senhaProvisoria;
  },

  delete: async (id: string): Promise<void> => {
    await httpClient(`${API_URL}/${id}`, {
      method: 'DELETE',
      auth: true,
      errorMessage: (err) => err?.erro || 'Erro ao excluir colaborador'
    });
  }
};