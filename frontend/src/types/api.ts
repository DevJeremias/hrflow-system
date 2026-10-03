// O contrato da API como ela responde: um tipo por endpoint, nos nomes do fio (snake_case onde a API
// usa). Os serviços em src/services convertem estes tipos nos modelos que as telas consomem.
import type { Perfil } from '../utils/sessao';

// Corpo de erro de qualquer endpoint. `detalhes` vem nas recusas de validação; `retryAfterSegundos`, no 429.
export interface ErroApi {
  erro?: string;
  mensagem?: string;
  detalhes?: { campo?: string | null; mensagem?: string }[];
  retryAfterSegundos?: number;
}

export interface MensagemApi {
  mensagem: string;
}

// --- Autenticação ---------------------------------------------------------------------------

// POST /api/auth/login
export interface LoginApi {
  perfil: Perfil;
  nome: string;
}

// GET /api/auth/sessao. `avatar` é o endereço da miniatura (GET /api/perfil/avatar), nunca o base64.
export interface SessaoApi {
  id: number;
  nome: string;
  perfil: Perfil;
  empresa_id: number;
  empresa_nome: string;
  funcionario_id: number | null;
  avatar: string | null;
}

// --- Funcionários ----------------------------------------------------------------------------

export type StatusDeFuncionarioApi = 'Ativo' | 'Inativo' | 'Férias' | (string & {});

// Cada item de GET /api/funcionarios (o total vem em X-Total-Count).
export interface FuncionarioApi {
  id: number;
  nome: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  cargo_id: number | null;
  cargo_nome: string | null;
  departamento_id: number | null;
  departamento_nome: string | null;
  status: StatusDeFuncionarioApi;
  data_admissao: string | null;
  data_nascimento: string | null;
  data_desligamento: string | null;
  motivo_desligamento: string | null;
  endereco: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  nivel: string | null;
  tipo_contrato: string | null;
  salario_base: string | number | null;
  // Perfil do acesso vinculado (null: sem acesso) e se há ponto ou justificativa.
  usuario_perfil: string | null;
  tem_movimento: boolean;
}

// Filtros de GET /api/funcionarios.
export interface ConsultaDeFuncionariosApi {
  pagina: number;
  limite: number;
  busca?: string;
  status?: string;
  departamento_id?: number;
}

// Corpo de POST /api/funcionarios e PUT /api/funcionarios/:id.
export interface CorpoDeFuncionarioApi {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  data_admissao: string;
  data_nascimento: string;
  endereco: string;
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  nivel: string;
  tipo_contrato: string;
  salario_base: string;
  cargo_id: number | null;
  departamento_id: number | null;
  // Só no cadastro.
  senha?: string;
}

// Corpo de PATCH /api/funcionarios/:id/status. Inativar exige data e motivo do desligamento.
export type CorpoDeStatusApi =
  | { status: 'Ativo' | 'Férias' }
  | { status: 'Inativo'; data_desligamento: string; motivo_desligamento: string };

// POST /api/funcionarios/:id/redefinir-senha: a senha provisória aparece só nesta resposta.
export interface SenhaProvisoriaApi extends MensagemApi {
  senhaProvisoria: string;
}

// --- Estrutura -------------------------------------------------------------------------------

// Cada item de GET /api/estrutura/departamentos.
export interface DepartamentoApi {
  id: number;
  nome: string;
  sigla: string;
  descricao: string | null;
  gestor: string | null;
  total_colaboradores: number | string;
  colaboradores_ativos: number | string;
  total_cargos: number | string;
}

// Cada item de GET /api/estrutura/cargos. salario_base é DECIMAL: chega como texto.
export interface CargoApi {
  id: number;
  nome: string;
  departamento_id: number | null;
  departamento_nome: string | null;
  departamento_sigla: string | null;
  nivel: string | null;
  salario_base: string | null;
  ocupantes: number | string;
}

// Corpo de POST/PUT /api/estrutura/departamentos.
export interface CorpoDeDepartamentoApi {
  nome: string;
  sigla: string;
  descricao: string;
  gestor: string;
}

// Corpo de POST/PUT /api/estrutura/cargos.
export interface CorpoDeCargoApi {
  nome: string;
  nivel: string;
  salario_base: number;
  departamento_id: number | null;
}

// --- Dashboard -------------------------------------------------------------------------------

// GET /api/dashboard/resumo
export interface ResumoDoDashboardApi {
  colaboradoresAtivos: number;
  colaboradoresInativos: number;
  departamentos: number;
  cargos: number;
  marcacoesHoje: number;
}

// --- Folha -----------------------------------------------------------------------------------

export interface LinhaDeHoleriteApi {
  description: string;
  value: number;
  isPercentage: boolean;
}

// Cada item de GET /api/folha/processar (o total vem em X-Total-Count) e de GET /api/folha/meu-holerite.
export interface HoleriteApi {
  id: string;
  name: string;
  role: string;
  department: string;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  totalGross: number;
  netSalary: number;
  employerCharges: number;
  earningsList: LinhaDeHoleriteApi[];
  deductionsList: LinhaDeHoleriteApi[];
}

// --- Ponto -----------------------------------------------------------------------------------

export type TipoDeRegistroApi = 'Entrada' | 'Pausa Almoço' | 'Retorno Almoço' | 'Saída';

// POST /api/ponto/registrar (201) e cada item de GET /api/ponto/hoje/:funcionarioId.
export interface RegistroDePontoApi {
  id: string;
  type: TipoDeRegistroApi;
  time: string;
  date: string;
}

// Corpo de POST /api/ponto/registrar.
export interface CorpoDeRegistroApi {
  tipo: string;
  latitude?: number;
  longitude?: number;
}

// Cada item de GET /api/ponto/historico/:funcionarioId?mes=.
export interface DiaDoHistoricoApi {
  id: string;
  date: string;
  entry: string;
  lunchOut: string;
  lunchIn: string;
  exit: string;
  totalHours: string;
  status: 'OK' | 'Atraso' | 'Falta' | 'Incompleto';
  note: string;
  negativeAdjust: string;
  positiveAdjust: string;
}

export interface TotalSemanalApi {
  id: string;
  weekLabel: string;
  workloadLimit: string;
  workloadPreset: string;
  workloadDone: string;
  presenceTime: string;
  pendingTime: string;
  excessTime: string;
  hoursBank: string;
  dailyAdjustBalance: string;
}

export type ResumoMensalApi = Omit<TotalSemanalApi, 'id' | 'weekLabel'>;

// GET /api/ponto/totais/:funcionarioId?mes=
export interface TotaisDePontoApi {
  totals: TotalSemanalApi[];
  monthlySummary: ResumoMensalApi;
}

// Cada item de GET /api/ponto?mes=&busca=&pagina=&limite= (o total vem em X-Total-Count).
export interface PontoDaEmpresaApi {
  id: number;
  funcionario_id: number;
  tipo_registro: string;
  nome_funcionario: string;
  date: string;
  time: string;
}

// --- Perfil ----------------------------------------------------------------------------------

// GET /api/perfil/meus-dados: a mesma forma para todos os perfis; o que depende do vínculo com o
// funcionário vem null quando `vinculado` é false.
export interface PerfilApi {
  perfil: Perfil;
  vinculado: boolean;
  nome: string;
  email: string;
  avatar: string | null;
  telefone: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  data_admissao: string | null;
  endereco: string | null;
  tipo_contrato: string | null;
  nivel: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  cargo: string | null;
  departamento: string | null;
}

// Corpo de PUT /api/perfil/meus-dados. `avatar` ausente mantém a foto, '' a remove e um data URL a troca.
export interface CorpoDeMeusDadosApi {
  nome: string;
  email: string;
  telefone: string;
  avatar?: string;
}

// Corpo de PUT /api/perfil/alterar-senha.
export interface CorpoDeAlterarSenhaApi {
  senhaAtual: string;
  novaSenha: string;
}

// --- Solicitações (sem backend ainda) --------------------------------------------------------

export type TipoDeSolicitacaoApi =
  | 'Férias'
  | 'Licença Médica'
  | 'Licença Maternidade'
  | 'Licença Paternidade'
  | 'Acidente de Trabalho'
  | 'Outros';

export type StatusDeSolicitacaoApi = 'Pendente' | 'Aprovada' | 'Recusada';

// GET /api/solicitacoes/minhas
export interface SolicitacaoApi {
  id: string | number;
  type: TipoDeSolicitacaoApi;
  requestDate: string;
  startDate: string;
  endDate: string;
  observation: string;
  hasAttachment: boolean;
  status: StatusDeSolicitacaoApi;
}
