import React, { useState } from 'react';
import ErrorAlert from '../ErrorAlert';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input, Select } from '../ui/Field';
import { mensagemDeErro } from '../../utils/erros';
import type { NewUser, NewUserProfile } from '../../services/usersService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: NewUser) => Promise<void>;
}

const UserModal: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [perfil, setPerfil] = useState<NewUserProfile>('RH');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const fechar = () => {
    setNome('');
    setEmail('');
    setPerfil('RH');
    setError(null);
    onClose();
  };

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSave({ nome, email, perfil });
      fechar();
    } catch (err) {
      setError(mensagemDeErro(err, 'Erro ao criar usuário'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Novo usuário"
      description="A conta nasce com uma senha provisória, que você entrega à pessoa."
      size="sm"
      onClose={fechar}
      form={{ onSubmit: enviar }}
      footer={(
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={fechar}>Cancelar</Button>
          <Button type="submit" loading={submitting}>{submitting ? 'Criando...' : 'Criar usuário'}</Button>
        </div>
      )}
    >
      <div className="space-y-5">
        {error && <ErrorAlert message={error} />}
        <Field label="Nome" name="nome" required>
          <Input data-autofocus autoComplete="off" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Maria Souza" />
        </Field>
        <Field label="E-mail de acesso" name="email" required>
          <Input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@empresa.com.br" />
        </Field>
        <Field label="Perfil" name="perfil" required>
          <Select value={perfil} onChange={(e) => setPerfil(e.target.value as NewUserProfile)}>
            <option value="RH">RH: gere colaboradores e folha</option>
            <option value="Administrador">Administrador: também gere estrutura e acessos</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
};

export default UserModal;
