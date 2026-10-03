import React, { useId, useState } from 'react';
import { Camera, X, Save } from 'lucide-react';
import type { PerfilUsuario, DadosEditaveis } from '../../services/userService';
import { useAtualizarMeuPerfil } from '../../queries/perfil';
import type { CorpoDeMeusDadosApi } from '../../types/api';
import { enderecoDoAvatar } from '../../utils/sessao';
import { mensagemDeErro } from '../../utils/erros';
import ErrorAlert from '../ErrorAlert';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import Field, { Input } from '../ui/Field';
import { useToast } from '../ui/toastContext';

interface Props {
  perfil: PerfilUsuario;
  onUpdate: (novosDados: DadosEditaveis) => void;
}

const dadosEditaveis = (perfil: PerfilUsuario): DadosEditaveis => ({
  nome: perfil.nome,
  email: perfil.email,
  telefone: perfil.telefone ?? '',
  avatar: perfil.avatar ?? ''
});

const Valor: React.FC<{ rotulo: string; children: React.ReactNode }> = ({ rotulo, children }) => (
  <div>
    <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">{rotulo}</dt>
    <dd className="rounded-card bg-surface-muted p-4 font-semibold text-ink">{children}</dd>
  </div>
);

const ProfileDataTab: React.FC<Props> = ({ perfil, onUpdate }) => {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<DadosEditaveis>(() => dadosEditaveis(perfil));
  const [status, setStatus] = useState({ loading: false, erro: '' });
  const atualizar = useAtualizarMeuPerfil();
  const idFoto = useId().replace(/:/g, '');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        e.target.value = '';
        toast.error('Imagem máxima de 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setEditForm(prev => ({ ...prev, avatar: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ loading: true, erro: '' });
    // A foto só viaja quando mudou: sem a chave, o servidor mantém a atual; '' a remove.
    const avatarAtual = perfil.avatar ?? '';
    const trocouAvatar = editForm.avatar !== avatarAtual;
    const corpo: CorpoDeMeusDadosApi = {
      nome: editForm.nome, email: editForm.email, telefone: editForm.telefone,
      ...(trocouAvatar ? { avatar: editForm.avatar } : {}),
    };
    try {
      await atualizar.mutateAsync(corpo);
      // O data URL digitado vira o endereço da miniatura que o servidor passou a servir.
      const avatar = !trocouAvatar || !editForm.avatar ? editForm.avatar : enderecoDoAvatar();
      const atualizados = { ...editForm, avatar };
      setEditForm(atualizados);
      setStatus({ loading: false, erro: '' });
      setIsEditing(false);
      onUpdate(atualizados);
      toast.success('Dados atualizados!');
    } catch (error) {
      setStatus({ loading: false, erro: mensagemDeErro(error, 'Erro ao atualizar dados') });
    }
  };

  const handleCancelar = () => {
    setEditForm(dadosEditaveis(perfil));
    setStatus({ loading: false, erro: '' });
    setIsEditing(false);
  };

  return (
    <form onSubmit={handleSalvar} className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-ink">Informações Pessoais</h2>
        {!isEditing && <Button variant="link" onClick={() => setIsEditing(true)}>Editar Dados</Button>}
      </div>

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
              <Input type="text" autoComplete="name" value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} />
            </Field>
          ) : (
            <p className="text-2xl font-bold text-ink">{perfil.nome}</p>
          )}
          <p className="mt-1 font-medium text-ink-muted">{perfil.cargo}</p>
        </div>
      </div>

      {isEditing ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="E-mail" name="email" required>
            <Input type="email" autoComplete="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
          </Field>
          {perfil.vinculado && (
            <Field label="Telefone" name="telefone">
              <Input type="tel" autoComplete="tel" value={editForm.telefone} onChange={e => setEditForm({ ...editForm, telefone: e.target.value })} />
            </Field>
          )}
        </div>
      ) : (
        <dl className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Valor rotulo="E-mail">{perfil.email}</Valor>
          {perfil.vinculado && <Valor rotulo="Telefone">{perfil.telefone || '-'}</Valor>}
        </dl>
      )}

      {isEditing && (
        <div className="flex gap-4 pt-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={handleCancelar} icon={<X size={18} aria-hidden="true" />}>Cancelar</Button>
          <Button type="submit" size="lg" className="flex-1" loading={status.loading} icon={<Save size={18} aria-hidden="true" />}>Salvar</Button>
        </div>
      )}
    </form>
  );
};

export default ProfileDataTab;
