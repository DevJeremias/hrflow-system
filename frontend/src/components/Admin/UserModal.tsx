import React, { useState } from 'react';
import { X } from 'lucide-react';
import ErrorAlert from '../ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import type { NewUser, NewUserProfile } from '../../services/usersService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: NewUser) => Promise<void>;
}

const campo = 'w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="novo-usuario-titulo">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={fechar} />
      <form onSubmit={enviar} className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="novo-usuario-titulo" className="text-2xl font-black text-slate-900 tracking-tight">Novo usuário</h2>
            <p className="text-sm font-medium text-slate-500">A conta nasce com uma senha provisória, que você entrega à pessoa.</p>
          </div>
          <button type="button" onClick={fechar} aria-label="Fechar" className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={22} /></button>
        </div>

        {error && <ErrorAlert message={error} />}

        <div className="space-y-2">
          <label htmlFor="usuario-nome" className="text-sm font-bold text-slate-700 ml-1">Nome *</label>
          <input id="usuario-nome" required value={nome} onChange={(e) => setNome(e.target.value)} className={campo} placeholder="Ex: Maria Souza" />
        </div>
        <div className="space-y-2">
          <label htmlFor="usuario-email" className="text-sm font-bold text-slate-700 ml-1">E-mail de acesso *</label>
          <input id="usuario-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={campo} placeholder="maria@empresa.com.br" />
        </div>
        <div className="space-y-2">
          <label htmlFor="usuario-perfil" className="text-sm font-bold text-slate-700 ml-1">Perfil *</label>
          <select id="usuario-perfil" value={perfil} onChange={(e) => setPerfil(e.target.value as NewUserProfile)} className={`${campo} cursor-pointer`}>
            <option value="RH">RH: gere colaboradores e folha</option>
            <option value="Administrador">Administrador: também gere estrutura e acessos</option>
          </select>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={fechar} className="rounded-2xl px-6 py-3 font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button type="submit" disabled={submitting} className="rounded-2xl bg-slate-900 px-8 py-3 font-bold text-white hover:bg-primary transition-colors disabled:opacity-60">
            {submitting ? 'Criando...' : 'Criar usuário'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserModal;
