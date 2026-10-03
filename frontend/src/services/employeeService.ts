import httpClient from './httpClient.ts';
import type {
  ConsultaDeFuncionariosApi, CorpoDeDependenteApi, CorpoDeEdicaoApi, CorpoDeFuncionarioApi, CorpoDeStatusApi, DadosDeFuncionarioApi,
  DependenteApi, FuncionarioApi, RelatorioDeImportacaoApi, SenhaProvisoriaApi,
} from '../types/api.ts';
import { mascaraCep, mascaraCpf, mascaraPis } from '../utils/mascaras.ts';

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

  // Documentos e matrícula.
  matricula?: string;
  rg?: string;
  pis?: string;
  ctps?: string;

  // Endereço em colunas; enderecoAnterior é o texto livre de antes delas, só para leitura.
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  enderecoAnterior?: string;

  contatoEmergenciaNome?: string;
  contatoEmergenciaTelefone?: string;
  contatoEmergenciaParentesco?: string;

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
  cpf: mascaraCpf(d.cpf || ''),
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
  matricula: d.matricula || '',
  rg: d.rg || '',
  pis: mascaraPis(d.pis || ''),
  ctps: d.ctps || '',
  cep: mascaraCep(d.cep || ''),
  logradouro: d.logradouro || '',
  numero: d.numero || '',
  complemento: d.complemento || '',
  bairro: d.bairro || '',
  cidade: d.cidade || '',
  uf: d.uf || '',
  enderecoAnterior: d.endereco || '',
  contatoEmergenciaNome: d.contato_emergencia_nome || '',
  contatoEmergenciaTelefone: d.contato_emergencia_telefone || '',
  contatoEmergenciaParentesco: d.contato_emergencia_parentesco || '',
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

// O formulário só guarda texto: do colaborador entram os campos que são texto ou número, e o que a
// tela sabe do cadastro mas não se edita aqui (perfil do acesso, se há movimento) fica de fora.
export const formularioDe = (employee: Employee): EmployeeForm => Object.fromEntries(
  Object.entries(employee).filter(([, value]) => typeof value === 'string' || typeof value === 'number')
) as EmployeeForm;

const texto = (valor: string | undefined): string => valor ?? '';

// Os dados do cadastro como a API os recebe; o que o formulário deixou em branco vai vazio.
const paraDados = (data: EmployeeForm): DadosDeFuncionarioApi => ({
  nome: texto(data.nomeCompleto),
  cpf: texto(data.cpf),
  email: texto(data.emailPessoal),
  telefone: texto(data.telefone),
  data_admissao: texto(data.dataAdmissao),
  data_nascimento: texto(data.dataNascimento),
  matricula: texto(data.matricula),
  rg: texto(data.rg),
  pis: texto(data.pis),
  ctps: texto(data.ctps),
  cep: texto(data.cep),
  logradouro: texto(data.logradouro),
  numero: texto(data.numero),
  complemento: texto(data.complemento),
  bairro: texto(data.bairro),
  cidade: texto(data.cidade),
  uf: texto(data.uf),
  contato_emergencia_nome: texto(data.contatoEmergenciaNome),
  contato_emergencia_telefone: texto(data.contatoEmergenciaTelefone),
  contato_emergencia_parentesco: texto(data.contatoEmergenciaParentesco),
  banco: texto(data.banco),
  agencia: texto(data.agencia),
  conta: texto(data.conta),
  tipo_conta: texto(data.tipoConta),
  nivel: texto(data.nivel),
  tipo_contrato: texto(data.tipoContrato),
  salario_base: texto(data.salarioBase),
  cargo_id: data.cargoId ? Number(data.cargoId) : null,
  departamento_id: data.departamentoId ? Number(data.departamentoId) : null,
});

// Só as chaves cujo valor mudou.
const diferencas = (atual: DadosDeFuncionarioApi, original: Partial<DadosDeFuncionarioApi>): CorpoDeEdicaoApi => Object.fromEntries(
  Object.entries(atual).filter(([chave, valor]) => valor !== original[chave as keyof DadosDeFuncionarioApi])
) as CorpoDeEdicaoApi;

export interface Dependent {
  id: string;
  nome: string;
  parentesco: string;
  dataNascimento: string;
  cpf: string;
}

export type DependentForm = Omit<Dependent, 'id'>;

const mapDependent = (d: DependenteApi): Dependent => ({
  id: String(d.id),
  nome: d.nome,
  parentesco: d.parentesco,
  dataNascimento: d.data_nascimento,
  cpf: mascaraCpf(d.cpf || ''),
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

  // Cadastro novo (POST, com a senha provisória) ou edição (PATCH só com o que mudou em relação ao
  // `original`). Sem nenhuma mudança nos dados a edição nem chama a API.
  save: async (data: EmployeeForm, original: Employee | null = null): Promise<void> => {
    if (!data.id) {
      const payload: CorpoDeFuncionarioApi = { ...paraDados(data), senha: data.senhaAcesso };
      await httpClient(API_URL, {
        method: 'POST',
        auth: true,
        body: JSON.stringify(payload),
        errorMessage: (err) => err?.erro || 'Erro ao salvar colaborador'
      });
      return;
    }

    const alteracoes = diferencas(paraDados(data), paraDados(original ? formularioDe(original) : {}));
    if (Object.keys(alteracoes).length === 0) return;
    await httpClient(`${API_URL}/${data.id}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(alteracoes satisfies CorpoDeEdicaoApi),
      errorMessage: (err) => err?.erro || 'Erro ao salvar colaborador'
    });
  },

  // Os dados vão por PATCH, só o que mudou; a situação (Férias, Inativo com data e motivo) só muda
  // por PATCH /:id/status, e só quando o formulário a alterou.
  saveEditingStatus: async (data: EmployeeForm, original: Employee | null): Promise<void> => {
    await employeeService.save(data, original);
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
  },

  getDependents: async (employeeId: string): Promise<Dependent[]> => {
    const data = await httpClient<DependenteApi[]>(`${API_URL}/${employeeId}/dependentes`, {
      auth: true,
      errorMessage: 'Erro ao buscar os dependentes'
    });
    return data.map(mapDependent);
  },

  // Sem `dependentId` cadastra um dependente novo; com ele, substitui os dados do existente.
  saveDependent: async (employeeId: string, form: DependentForm, dependentId?: string): Promise<void> => {
    const payload: CorpoDeDependenteApi = {
      nome: form.nome,
      parentesco: form.parentesco,
      data_nascimento: form.dataNascimento,
      cpf: form.cpf,
    };
    await httpClient(`${API_URL}/${employeeId}/dependentes${dependentId ? `/${dependentId}` : ''}`, {
      method: dependentId ? 'PUT' : 'POST',
      auth: true,
      body: JSON.stringify(payload),
      errorMessage: (err) => err?.erro || 'Erro ao salvar o dependente'
    });
  },

  deleteDependent: async (employeeId: string, dependentId: string): Promise<void> => {
    await httpClient(`${API_URL}/${employeeId}/dependentes/${dependentId}`, {
      method: 'DELETE',
      auth: true,
      errorMessage: (err) => err?.erro || 'Erro ao remover o dependente'
    });
  },

  // O arquivo vai como texto (text/csv); a API cria as linhas válidas e devolve as demais com o motivo.
  importCsv: (csv: string): Promise<RelatorioDeImportacaoApi> => httpClient<RelatorioDeImportacaoApi>(`${API_URL}/importar`, {
    method: 'POST',
    auth: true,
    headers: { 'Content-Type': 'text/csv' },
    body: csv,
    errorMessage: (err) => err?.erro || 'Erro ao importar os colaboradores'
  })
};
