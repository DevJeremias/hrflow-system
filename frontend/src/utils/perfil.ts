// O que a edição do perfil muda de verdade, separado pela regra de quem grava: telefone e foto o próprio colaborador
// grava na hora; nome, e-mail, endereço e dados bancários dependem de aprovação (modules/solicitacoes na API).
import type { CorpoDeSolicitacaoApi, PerfilApi } from '../types/api.ts';

export interface FormularioDoPerfil {
  nome: string;
  email: string;
  telefone: string;
  // O endereço da foto atual, '' (sem foto) ou o data URL de uma nova.
  avatar: string;
  endereco: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
}

export const formularioDoPerfil = (perfil: PerfilApi): FormularioDoPerfil => ({
  nome: perfil.nome,
  email: perfil.email,
  telefone: perfil.telefone ?? '',
  avatar: perfil.avatar ?? '',
  endereco: perfil.endereco ?? '',
  banco: perfil.banco ?? '',
  agencia: perfil.agencia ?? '',
  conta: perfil.conta ?? '',
  tipoConta: perfil.tipo_conta ?? '',
});

export interface AlteracoesDoPerfil {
  // O que depende de aprovação (sem a senha atual, que quem envia acrescenta ao trocar o e-mail).
  protegidas: Omit<CorpoDeSolicitacaoApi, 'senhaAtual'>;
  // Ausentes quando não mudaram. `avatar` '' remove a foto.
  telefone?: string;
  avatar?: string;
}

// Só os campos que mudaram entram: a API recusa um pedido igual ao que está gravado. Endereço e dados
// bancários só existem para quem tem cadastro de colaborador.
export const alteracoesDoPerfil = (perfil: PerfilApi, form: FormularioDoPerfil): AlteracoesDoPerfil => {
  const protegidas: AlteracoesDoPerfil['protegidas'] = {};
  const nome = form.nome.trim();
  const email = form.email.trim().toLowerCase();
  if (nome !== perfil.nome) protegidas.nome = nome;
  if (email !== perfil.email) protegidas.email = email;
  if (perfil.vinculado) {
    const cadastro = [
      ['endereco', form.endereco, perfil.endereco], ['banco', form.banco, perfil.banco], ['agencia', form.agencia, perfil.agencia],
      ['conta', form.conta, perfil.conta], ['tipo_conta', form.tipoConta, perfil.tipo_conta],
    ] as const;
    for (const [campo, novo, atual] of cadastro) {
      if (novo.trim() !== (atual ?? '')) protegidas[campo] = novo.trim();
    }
  }

  const alteracoes: AlteracoesDoPerfil = { protegidas };
  if (perfil.vinculado && form.telefone.trim() !== (perfil.telefone ?? '')) alteracoes.telefone = form.telefone.trim();
  if (form.avatar !== (perfil.avatar ?? '')) alteracoes.avatar = form.avatar;
  return alteracoes;
};

export const haAlteracoes = ({ protegidas, telefone, avatar }: AlteracoesDoPerfil): boolean =>
  Object.keys(protegidas).length > 0 || telefone !== undefined || avatar !== undefined;
