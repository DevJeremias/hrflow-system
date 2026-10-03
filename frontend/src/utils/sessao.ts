export const PERFIS = ['Administrador', 'RH', 'Colaborador'] as const;
export type Perfil = typeof PERFIS[number];

// Perfis que o backend deixa gerir colaboradores, estrutura e folha (Administrador e RH).
const PERFIS_DE_GESTAO: readonly Perfil[] = ['Administrador', 'RH'];

export const ehGestao = (perfil: Perfil | undefined): boolean =>
  perfil !== undefined && PERFIS_DE_GESTAO.includes(perfil);

export const ehAdministrador = (perfil: Perfil | undefined): boolean => perfil === 'Administrador';

export const rotaInicial = (perfil: Perfil): string => (ehGestao(perfil) ? '/admin' : '/meu-painel');

export interface User {
  id: number;
  nome: string;
  role: Perfil;
  funcionarioId: number | null;
  empresaNome: string;
  avatar?: string | null;
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
  const { id, nome, perfil, funcionario_id: funcionarioId, empresa_nome: empresaNome, avatar } = dados as Record<string, unknown>;

  if (!ehId(id) || typeof nome !== 'string' || !nome.trim() || !ehPerfil(perfil)) return null;
  if (typeof empresaNome !== 'string' || !empresaNome.trim()) return null;
  if (funcionarioId !== null && !ehId(funcionarioId)) return null;
  if (avatar !== null && avatar !== undefined && typeof avatar !== 'string') return null;

  return { id, nome, role: perfil, funcionarioId, empresaNome, avatar: avatar ?? null };
};
