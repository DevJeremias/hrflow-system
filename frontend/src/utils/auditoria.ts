// Como a trilha de auditoria aparece na tela: o nome de cada ação e o resumo "campo: antes -> depois" do
// que mudou. Os códigos e os campos são os de backend/modules/*, que gravam a trilha (shared/utils/auditar.ts).
import type { RegistroDeAuditoriaApi } from '../types/api.ts';

const ACOES: Record<string, string> = {
  'login.sucesso': 'Entrou no sistema',
  'login.falha': 'Tentativa de entrada recusada',
  'funcionario.criado': 'Colaborador cadastrado',
  'funcionario.editado': 'Cadastro alterado',
  'funcionario.salario_alterado': 'Salário alterado',
  'funcionario.desligado': 'Colaborador desligado',
  'funcionario.reativado': 'Colaborador reativado',
  'funcionario.situacao_alterada': 'Situação alterada',
  'funcionario.senha_redefinida': 'Senha redefinida pela gestão',
  'funcionario.excluido': 'Cadastro excluído',
  'funcionario.exportado': 'Dados exportados',
  'funcionario.anonimizado': 'Cadastro anonimizado',
  'folha.processada': 'Folha processada',
  'folha.fechada': 'Folha fechada',
  'justificativa.enviada': 'Justificativa de ponto enviada',
  'justificativa.decidida': 'Justificativa de ponto decidida',
  'senha.alterada': 'Senha trocada pela própria pessoa',
  'usuario.criado': 'Acesso criado',
  'usuario.editado': 'Acesso alterado',
  'usuario.senha_redefinida': 'Senha do acesso redefinida',
  'perfil.atualizado': 'Dados pessoais atualizados',
  'solicitacao.criada': 'Alteração solicitada',
  'solicitacao.aprovada': 'Alteração aprovada',
  'solicitacao.recusada': 'Alteração recusada',
};

export const rotuloDaAcao = (acao: string): string => ACOES[acao] ?? acao;

const CAMPOS: Record<string, string> = {
  nome: 'Nome', email: 'E-mail', cpf: 'CPF', telefone: 'Telefone', data_nascimento: 'Nascimento', data_admissao: 'Admissão',
  endereco: 'Endereço', banco: 'Banco', agencia: 'Agência', conta: 'Conta', tipo_conta: 'Tipo de conta', nivel: 'Nível',
  tipo_contrato: 'Contrato', salario_base: 'Salário', cargo: 'Cargo', departamento: 'Departamento', status: 'Situação',
  data_desligamento: 'Desligamento', motivo_desligamento: 'Motivo do desligamento', competencia: 'Competência',
  colaboradores: 'Colaboradores na folha', pendencias: 'Pendências', criada: 'Primeira vez', resposta: 'Resposta',
  motivo: 'Motivo', avatar: 'Foto', data: 'Dia', texto: 'Texto', perfil: 'Perfil', tipo_registro: 'Tipo',
};

// cargo_id e departamento_id acompanham o nome do cargo e do departamento, que é o que se lê.
const OCULTOS = new Set(['cargo_id', 'departamento_id', 'usuario_id']);

const MOTIVOS_DE_LOGIN: Record<string, string> = {
  conta_inexistente: 'e-mail sem conta',
  senha_incorreta: 'senha incorreta',
  acesso_desativado: 'acesso desativado',
};

const AVATAR: Record<string, string> = { alterado: 'trocada', removido: 'removida' };

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const COMPETENCIA = /^\d{4}-\d{2}$/;

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const valorDe = (campo: string, valor: unknown): string => {
  if (valor === null || valor === undefined || valor === '') return 'vazio';
  if (typeof valor === 'boolean') return valor ? 'sim' : 'não';
  if (campo === 'salario_base' && !Number.isNaN(Number(valor))) return moeda.format(Number(valor));
  if (campo === 'motivo' && typeof valor === 'string') return MOTIVOS_DE_LOGIN[valor] ?? valor;
  if (campo === 'avatar' && typeof valor === 'string') return AVATAR[valor] ?? valor;
  if (typeof valor === 'string' && DATA_ISO.test(valor)) return valor.split('-').reverse().join('/');
  if (campo === 'competencia' && typeof valor === 'string' && COMPETENCIA.test(valor)) return valor.split('-').reverse().join('/');
  return String(valor);
};

// Uma linha por campo que mudou: "Salário: R$ 3.000,00 → R$ 3.500,00"; sem o valor de antes (criação, ou ação que
// só tem "depois"), só o valor. Ação sem detalhe devolve lista vazia.
export const resumoDaMudanca = ({ antes, depois }: Pick<RegistroDeAuditoriaApi, 'antes' | 'depois'>): string[] => {
  const campos = [...new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})])].filter((campo) => !OCULTOS.has(campo));
  return campos.map((campo) => {
    const rotulo = CAMPOS[campo] ?? campo;
    const novo = valorDe(campo, depois?.[campo]);
    return antes && campo in antes ? `${rotulo}: ${valorDe(campo, antes[campo])} → ${novo}` : `${rotulo}: ${novo}`;
  });
};
