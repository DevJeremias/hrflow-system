import React, { useId, useState } from 'react';
import { Camera, X, Save } from 'lucide-react';
import type { PerfilUsuario } from '../../services/userService';
import { useAtualizarMeuPerfil } from '../../queries/perfil';
import { useEnviarPedido } from '../../queries/solicitacoesAlteracao';
import type { CorpoDeMeusDadosApi } from '../../types/api';
import { enderecoDoAvatar } from '../../utils/sessao';
import { alteracoesDoPerfil, formularioDoPerfil, haAlteracoes, type FormularioDoPerfil } from '../../utils/perfil';
import { mensagemDeErro } from '../../utils/erros';
import { mensagemDeLimite } from '../../utils/espera';
import { HttpError } from '../../services/httpClient';
import { useAuth } from '../../contexts/AuthContext';
import ErrorAlert from '../ErrorAlert';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import Field, { Input, Select } from '../ui/Field';
import { useToast } from '../ui/toastContext';
import MeusPedidos from './MeusPedidos';

interface Props {
  perfil: PerfilUsuario;
  // O que mudou na identidade da sessão (nome e foto) depois de salvar.
  onUpdate: (identidade: { nome?: string; avatar?: string | null }) => void;
}

const AVISO_EMAIL_ALTERADO = 'E-mail de acesso alterado. Entre novamente com o novo e-mail.';

const Valor: React.FC<{ rotulo: string; children: React.ReactNode }> = ({ rotulo, children }) => (
  <div>
    <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">{rotulo}</dt>
    <dd className="break-words rounded-card bg-surface-muted p-4 font-semibold text-ink">{children}</dd>
  </div>
);

const ProfileDataTab: React.FC<Props> = ({ perfil, onUpdate }) => {
  const toast = useToast();
  const { user, logout } = useAuth();
  // O Administrador não tem a quem pedir: grava direto. Os outros pedem, e quem gere o cadastro decide.
  const grava = user?.role === 'Administrador';
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<FormularioDoPerfil>(() => formularioDoPerfil(perfil));
  const [senhaAtual, setSenhaAtual] = useState('');
  const [status, setStatus] = useState({ loading: false, erro: '' });
  const atualizar = useAtualizarMeuPerfil();
  const enviarPedido = useEnviarPedido();
  const idFoto = useId().replace(/:/g, '');

  const alteracoes = alteracoesDoPerfil(perfil, editForm);
  const trocaDeEmail = alteracoes.protegidas.email !== undefined;
  const alterar = (parcial: Partial<FormularioDoPerfil>) => setEditForm((atual) => ({ ...atual, ...parcial }));

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        e.target.value = '';
        toast.error('Imagem máxima de 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => alterar({ avatar: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!haAlteracoes(alteracoes)) {
      setIsEditing(false);
      return;
    }
    if (trocaDeEmail && !senhaAtual) {
      setStatus({ loading: false, erro: 'Informe a senha atual para trocar o e-mail de acesso.' });
      return;
    }
    setStatus({ loading: true, erro: '' });
    const { protegidas, telefone, avatar } = alteracoes;
    const imediatos: CorpoDeMeusDadosApi = { ...(telefone !== undefined ? { telefone } : {}), ...(avatar !== undefined ? { avatar } : {}) };
    const comSenha = trocaDeEmail ? { senhaAtual } : {};
    try {
      if (grava) {
        const salvo = await atualizar.mutateAsync({ ...protegidas, ...imediatos, ...comSenha });
        if (salvo.sessaoEncerrada) {
          await logout(AVISO_EMAIL_ALTERADO);
          return;
        }
      } else {
        // O pedido primeiro: se ele for recusado (senha errada, e-mail em uso), nada mais é gravado.
        if (Object.keys(protegidas).length > 0) await enviarPedido.mutateAsync({ ...protegidas, ...comSenha });
        if (Object.keys(imediatos).length > 0) await atualizar.mutateAsync(imediatos);
      }
      // O endereço da miniatura que o servidor passou a servir; o data URL digitado só serve de prévia.
      const novaFoto = avatar === undefined ? undefined : (avatar ? enderecoDoAvatar() : null);
      onUpdate({ ...(grava && protegidas.nome ? { nome: protegidas.nome } : {}), ...(novaFoto !== undefined ? { avatar: novaFoto } : {}) });
      // O que dependia de aprovação volta ao valor atual; o que foi gravado (telefone, foto e, para o Administrador, tudo) fica.
      setEditForm({ ...(grava ? editForm : { ...formularioDoPerfil(perfil), telefone: editForm.telefone }), avatar: novaFoto === undefined ? editForm.avatar : (novaFoto ?? '') });
      setSenhaAtual('');
      setStatus({ loading: false, erro: '' });
      setIsEditing(false);
      toast.success(!grava && Object.keys(protegidas).length > 0
        ? 'Solicitação enviada. Os dados atuais continuam valendo até a decisão.'
        : 'Dados atualizados!');
    } catch (error) {
      const mensagem = mensagemDeErro(error, 'Erro ao atualizar dados');
      setStatus({ loading: false, erro: error instanceof HttpError && error.status === 429 ? mensagemDeLimite(error.data, mensagem) : mensagem });
    }
  };

  const handleCancelar = () => {
    setEditForm(formularioDoPerfil(perfil));
    setSenhaAtual('');
    setStatus({ loading: false, erro: '' });
    setIsEditing(false);
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSalvar} className="space-y-8 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">Informações Pessoais</h2>
          {!isEditing && <Button variant="link" onClick={() => setIsEditing(true)}>Editar Dados</Button>}
        </div>

        {isEditing && !grava && (
          <p className="rounded-control bg-info-soft p-4 text-sm text-ink">
            Telefone e foto mudam na hora. <strong>Nome, e-mail de acesso, endereço e dados bancários</strong> passam por aprovação
            {user?.role === 'RH' ? ' do Administrador' : ' do RH'}: enviamos o pedido e os dados atuais valem até a decisão.
          </p>
        )}

        {status.erro && <ErrorAlert message={status.erro} />}

        <div className="flex items-center gap-6 border-b border-line pb-8">
          <div className="relative">
            <Avatar name={perfil.nome} src={editForm.avatar} size="lg" alt="Foto de perfil" />
            {isEditing && (
              <>
                {/* O campo de arquivo fica fora da tela, mas focável: o rótulo é o botão da câmera e mostra o foco do campo. */}
                <input id={idFoto} name="avatar" type="file" accept="image/*" className="peer sr-only" onChange={handleImageUpload} />
                <label htmlFor={idFoto} className="absolute bottom-0 right-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-ink text-white hover:bg-ink-muted peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
                  <Camera size={16} aria-hidden="true" />
                  <span className="sr-only">Alterar foto</span>
                </label>
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <Field label="Nome" name="name" required className="max-w-sm">
                <Input type="text" autoComplete="name" value={editForm.nome} onChange={e => alterar({ nome: e.target.value })} />
              </Field>
            ) : (
              <p className="text-2xl font-bold text-ink">{perfil.nome}</p>
            )}
            <p className="mt-1 font-medium text-ink-muted">{perfil.cargo}</p>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Field label="E-mail de acesso" name="email" required>
                <Input type="email" autoComplete="email" value={editForm.email} onChange={e => alterar({ email: e.target.value })} />
              </Field>
              {perfil.vinculado && (
                <Field label="Telefone" name="telefone">
                  <Input type="tel" autoComplete="tel" value={editForm.telefone} onChange={e => alterar({ telefone: e.target.value })} />
                </Field>
              )}
              {trocaDeEmail && (
                <Field label="Senha atual" name="senhaAtual" required hint="Para trocar o e-mail de acesso, confirme que é você. As outras sessões abertas serão encerradas." className="md:col-span-2">
                  <Input type="password" autoComplete="current-password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} />
                </Field>
              )}
            </div>

            {perfil.vinculado && (
              <fieldset className="space-y-6">
                <legend className="mb-4 text-sm font-bold uppercase tracking-wider text-ink-muted">Endereço e dados bancários</legend>
                <Field label="Endereço" name="endereco">
                  <Input type="text" autoComplete="street-address" maxLength={500} value={editForm.endereco} onChange={e => alterar({ endereco: e.target.value })} />
                </Field>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                  <Field label="Banco" name="banco" className="md:col-span-2">
                    <Input type="text" autoComplete="off" maxLength={100} value={editForm.banco} onChange={e => alterar({ banco: e.target.value })} />
                  </Field>
                  <Field label="Agência" name="agencia">
                    <Input type="text" autoComplete="off" maxLength={20} value={editForm.agencia} onChange={e => alterar({ agencia: e.target.value })} />
                  </Field>
                  <Field label="Conta" name="conta">
                    <Input type="text" autoComplete="off" maxLength={20} value={editForm.conta} onChange={e => alterar({ conta: e.target.value })} />
                  </Field>
                  <Field label="Tipo de conta" name="tipoConta">
                    <Select autoComplete="off" value={editForm.tipoConta} onChange={e => alterar({ tipoConta: e.target.value })}>
                      <option value="">Não informado</option>
                      <option value="Corrente">Corrente</option>
                      <option value="Poupanca">Poupança</option>
                      <option value="Salario">Salário</option>
                    </Select>
                  </Field>
                </div>
              </fieldset>
            )}
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Valor rotulo="E-mail de acesso">{perfil.email}</Valor>
            {perfil.vinculado && <Valor rotulo="Telefone">{perfil.telefone || '-'}</Valor>}
            {perfil.vinculado && <Valor rotulo="Endereço">{perfil.endereco || '-'}</Valor>}
          </dl>
        )}

        {isEditing && (
          <div className="flex gap-4 pt-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={handleCancelar} icon={<X size={18} aria-hidden="true" />}>Cancelar</Button>
            <Button type="submit" size="lg" className="flex-1" loading={status.loading} icon={<Save size={18} aria-hidden="true" />}>
              {grava || Object.keys(alteracoes.protegidas).length === 0 ? 'Salvar' : 'Salvar e enviar pedido'}
            </Button>
          </div>
        )}
      </form>

      <MeusPedidos />
    </div>
  );
};

export default ProfileDataTab;
