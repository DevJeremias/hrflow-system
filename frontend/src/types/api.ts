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
  // Texto livre de antes do endereço em colunas: só leitura.
  endereco: string | null;
  matricula: string | null;
  rg: string | null;
  pis: string | null;
  ctps: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  contato_emergencia_parentesco: string | null;
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

// Os dados do cadastro de um colaborador, como a API os recebe.
export interface DadosDeFuncionarioApi {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  data_admissao: string;
  data_nascimento: string;
  matricula: string;
  rg: string;
  pis: string;
  ctps: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  contato_emergencia_nome: string;
  contato_emergencia_telefone: string;
  contato_emergencia_parentesco: string;
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  nivel: string;
  tipo_contrato: string;
  salario_base: string;
  cargo_id: number | null;
  departamento_id: number | null;
}

// Corpo de POST /api/funcionarios: os dados e a senha provisória.
export interface CorpoDeFuncionarioApi extends DadosDeFuncionarioApi {
  senha?: string;
}

// Corpo de PATCH /api/funcionarios/:id: só os campos que mudaram.
export type CorpoDeEdicaoApi = Partial<DadosDeFuncionarioApi>;

// Itens e corpo de /api/funcionarios/:id/dependentes.
export type ParentescoApi = 'Filho(a)' | 'Cônjuge' | 'Enteado(a)' | 'Pai ou mãe' | 'Outro';

export interface DependenteApi {
  id: number;
  nome: string;
  parentesco: ParentescoApi;
  data_nascimento: string;
  cpf: string | null;
}

export interface CorpoDeDependenteApi {
  nome: string;
  parentesco: string;
  data_nascimento: string;
  cpf: string;
}

// Resposta de POST /api/funcionarios/importar: o que foi criado e o que ficou de fora, linha a linha.
export interface RelatorioDeImportacaoApi {
  total: number;
  criados: number;
  erros: { linha: number; nome: string | null; motivo: string }[];
  // As senhas provisórias só existem nesta resposta.
  credenciais: { linha: number; nome: string; email: string; senha_provisoria: string }[];
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

export type StatusDoDiaApi = 'ok' | 'atraso' | 'incompleto' | 'falta' | 'justificado' | 'fim_de_semana';

export type StatusDaJustificativaApi = 'pendente' | 'aprovada' | 'recusada';

// Cada item de GET /api/ponto/historico/:funcionarioId?mes=. `open` marca o dia ainda sem apuração
// (futuro, hoje sem saída ou antes da admissão); `delay` e os ajustes são 'HH:MM'; `note*` é a
// justificativa do colaborador e o que o RH decidiu sobre ela.
export interface DiaDoHistoricoApi {
  id: string;
  date: string;
  entry: string;
  lunchOut: string;
  lunchIn: string;
  exit: string;
  totalHours: string;
  status: StatusDoDiaApi;
  open: boolean;
  delay: string;
  note: string;
  noteStatus: StatusDaJustificativaApi | null;
  noteReply: string | null;
  negativeAdjust: string;
  positiveAdjust: string;
}

export interface TotaisDoPeriodoApi {
  workloadLimit: string;
  workloadDone: string;
  pendingTime: string;
  excessTime: string;
  delayTime: string;
  absences: number;
  incompleteDays: number;
}

export interface TotalSemanalApi extends TotaisDoPeriodoApi {
  id: string;
  weekLabel: string;
}

export interface JornadaApi {
  weeklyHours: number;
  entry: string;
  exit: string;
  toleranceMinutes: number;
}

// GET /api/ponto/totais/:funcionarioId?mes=
export interface TotaisDePontoApi {
  workSchedule: JornadaApi;
  totals: TotalSemanalApi[];
  monthlySummary: TotaisDoPeriodoApi;
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

// Cada item de GET /api/ponto/justificativas?mes=&status= e a resposta de PATCH /api/ponto/justificativas/:id.
export interface JustificativaApi {
  id: number;
  funcionario_id: number;
  nome_funcionario: string;
  date: string;
  note: string;
  status: StatusDaJustificativaApi;
  reply: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Corpo de PATCH /api/ponto/justificativas/:id. A recusa exige o motivo.
export interface DecisaoDeJustificativaApi {
  status: 'aprovada' | 'recusada';
  resposta?: string;
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
