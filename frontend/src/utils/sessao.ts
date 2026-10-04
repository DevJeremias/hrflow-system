import { FUSO_PADRAO } from './fuso.ts';

export const PERFIS = ['Administrador', 'RH', 'Colaborador'] as const;
export type Perfil = typeof PERFIS[number];

// Perfis que o backend deixa gerir colaboradores, estrutura e folha (Administrador e RH).
const PERFIS_DE_GESTAO: readonly Perfil[] = ['Administrador', 'RH'];

export const ehGestao = (perfil: Perfil | undefined): boolean =>
  perfil !== undefined && PERFIS_DE_GESTAO.includes(perfil);

export const ehAdministrador = (perfil: Perfil | undefined): boolean => perfil === 'Administrador';

export const rotaInicial = (perfil: Perfil): string => (ehGestao(perfil) ? '/admin' : '/meu-painel');

// Quem entrou com a senha que o RH definiu só pode trocá-la: o servidor recusa o resto (403).
export const ROTA_TROCA_DE_SENHA = '/trocar-senha';

export const rotaDepoisDoLogin = (usuario: Pick<User, 'role' | 'senhaProvisoria'>): string =>
  (usuario.senhaProvisoria ? ROTA_TROCA_DE_SENHA : rotaInicial(usuario.role));

// Para onde o login leva: à troca de senha, se a senha é provisória; senão, de volta à tela que o
// ProtectedRoute interrompeu (guardada em `state.from`) ou, sem ela, ao painel do perfil. Só
// caminho interno do app é aceito.
export const destinoDoLogin = (estado: unknown, usuario: Pick<User, 'role' | 'senhaProvisoria'>): string => {
  if (usuario.senhaProvisoria) return ROTA_TROCA_DE_SENHA;
  const origem = (estado as { from?: unknown } | null | undefined)?.from;
  const interno = typeof origem === 'string' && origem.startsWith('/') && !origem.startsWith('//') && !origem.startsWith('/\\');
  return interno && origem !== '/login' && !origem.startsWith('/login?') ? origem : rotaInicial(usuario.role);
};

export interface User {
  id: number;
  nome: string;
  role: Perfil;
  funcionarioId: number | null;
  empresaNome: string;
  // Fuso IANA da empresa ('America/Manaus'): o dia do ponto e o mês da folha seguem ele.
  empresaFuso: string;
  avatar?: string | null;
  senhaProvisoria: boolean;
}

// Quem tem cadastro de funcionário bate ponto e vê o próprio holerite em qualquer perfil. O
// Colaborador entra mesmo sem vínculo: o painel dele explica a pendência em vez de redirecionar.
export const temAreaPessoal = (user: Pick<User, 'role' | 'funcionarioId'>): boolean =>
  user.role === 'Colaborador' || user.funcionarioId !== null;

const ehPerfil = (valor: unknown): valor is Perfil => PERFIS.includes(valor as Perfil);
const ehId = (valor: unknown): valor is number => Number.isInteger(valor) && (valor as number) > 0;

// Valida a resposta de GET /api/auth/sessao antes de ela virar identidade no front-end.
// Devolve null se algo não bate: quem chama trata como sessão inválida.
export const lerSessao = (dados: unknown): User | null => {
  if (typeof dados !== 'object' || dados === null) return null;
  const { id, nome, perfil, funcionario_id: funcionarioId, empresa_nome: empresaNome, empresa_fuso: empresaFuso, avatar, senha_provisoria: senhaProvisoria } = dados as Record<string, unknown>;

  if (!ehId(id) || typeof nome !== 'string' || !nome.trim() || !ehPerfil(perfil)) return null;
  if (typeof empresaNome !== 'string' || !empresaNome.trim()) return null;
  if (funcionarioId !== null && !ehId(funcionarioId)) return null;
  if (avatar !== null && avatar !== undefined && typeof avatar !== 'string') return null;

  // Ausente vale como falso: uma API anterior a este campo nunca marcou senha provisória.
  // Ausente vale Belém: uma API anterior a este campo servia um fuso só.
  const fuso = typeof empresaFuso === 'string' && empresaFuso.trim() ? empresaFuso : FUSO_PADRAO;

  return { id, nome, role: perfil, funcionarioId, empresaNome, empresaFuso: fuso, avatar: avatar ?? null, senhaProvisoria: senhaProvisoria === true };
};

// A API serve a miniatura do avatar em um endereço fixo; `versao` força o navegador a buscar de novo
// quando a foto acabou de mudar.
export const enderecoDoAvatar = (versao: number = Date.now()): string => `/api/perfil/avatar?v=${versao}`;
