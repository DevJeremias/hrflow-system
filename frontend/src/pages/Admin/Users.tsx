import React, { useState, useEffect, useCallback } from 'react';
import { Plus, KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AccessUser, NewUser, usersService } from '../../services/usersService';
import UserModal from '../../components/Admin/UserModal';
import ProvisionalPasswordPanel from '../../components/Admin/ProvisionalPasswordPanel';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import { PERFIS, Perfil } from '../../utils/sessao';

const PAGE_SIZE = 50;

const PROFILE_COLORS: Record<Perfil, string> = {
  Administrador: 'bg-indigo-100 text-indigo-700',
  RH: 'bg-sky-100 text-sky-700',
  Colaborador: 'bg-slate-100 text-slate-600',
};

// Quem não tem cadastro de funcionário não tem o que fazer como Colaborador (ponto, holerite).
const profilesFor = (user: AccessUser): readonly Perfil[] =>
  user.funcionarioId === null ? PERFIS.filter((p) => p !== 'Colaborador') : PERFIS;

interface Delivery {
  nome: string;
  email: string;
  senha: string;
}

const Users: React.FC = () => {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [delivery, setDelivery] = useState<Delivery | null>(null);

  const load = useCallback(async (requestedPage: number) => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await usersService.getPage(requestedPage, PAGE_SIZE);
      setUsers(result.users);
      setTotal(result.total);
      setPage(requestedPage);
    } catch (error) {
      setLoadError(mensagemDeErro(error, 'Erro ao buscar usuários'));
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => load(1));
  }, [load]);

  // O erro sobe até o modal, que o mostra junto ao formulário e mantém o que foi digitado.
  const handleCreate = async (novo: NewUser) => {
    const { user, senhaProvisoria } = await usersService.create(novo);
    if (senhaProvisoria) setDelivery({ nome: user.nome, email: user.email, senha: senhaProvisoria });
    setActionError(null);
    await load(page);
  };

  const handleProfile = async (target: AccessUser, perfil: Perfil) => {
    if (perfil === target.perfil) return;
    if (!window.confirm(`Mudar o perfil de ${target.nome} para ${perfil}? A pessoa precisará entrar de novo.`)) return;
    try {
      await usersService.update(target.id, { perfil });
      setActionError(null);
      await load(page);
    } catch (error) {
      setActionError(mensagemDeErro(error, 'Erro ao alterar o perfil.'));
    }
  };

  const handleReset = async (target: AccessUser) => {
    if (!window.confirm(`Redefinir a senha de ${target.nome}? A senha atual deixa de valer e a pessoa será desconectada.`)) return;
    try {
      const { senhaProvisoria } = await usersService.update(target.id, { redefinirSenha: true });
      if (senhaProvisoria) setDelivery({ nome: target.nome, email: target.email, senha: senhaProvisoria });
      setActionError(null);
      await load(page);
    } catch (error) {
      setActionError(mensagemDeErro(error, 'Erro ao redefinir a senha.'));
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <UserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleCreate} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Usuários</h1>
          <p className="text-slate-500 font-medium">Quem acessa o sistema e com qual perfil. Colaboradores nascem no cadastro de colaboradores.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="group flex items-center justify-center gap-3 bg-slate-900 hover:bg-primary text-white font-bold py-4 px-8 rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-95"
        >
          <Plus size={22} className="group-hover:rotate-90 transition-transform duration-300" />
          <span>Novo usuário</span>
        </button>
      </div>

      {delivery && <ProvisionalPasswordPanel {...delivery} onClose={() => setDelivery(null)} />}
      {actionError && <ErrorAlert message={actionError} />}
      {loadError && <ErrorAlert message={loadError} onRetry={() => load(page)} />}

      {!loadError && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Usuário</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Perfil</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Situação</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse border-b border-slate-50">
                      <td colSpan={4} className="py-6 px-6"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                    </tr>
                  ))
                ) : users.length > 0 ? (
                  users.map((u) => {
                    const isMe = u.id === me?.id;
                    return (
                      <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6">
                          <p className="font-bold text-slate-900">{u.nome}{isMe && <span className="ml-2 text-xs font-bold text-slate-400">(você)</span>}</p>
                          <p className="text-xs text-slate-500 break-all">{u.email}</p>
                        </td>
                        <td className="py-4 px-6">
                          {isMe ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${PROFILE_COLORS[u.perfil]}`}>{u.perfil}</span>
                          ) : (
                            <select
                              aria-label={`Perfil de ${u.nome}`}
                              value={u.perfil}
                              onChange={(e) => handleProfile(u, e.target.value as Perfil)}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold border-0 cursor-pointer outline-none focus:ring-4 focus:ring-primary/10 ${PROFILE_COLORS[u.perfil]}`}
                            >
                              {profilesFor(u).map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="py-4 px-6 text-sm">
                          {u.senhaProvisoria
                            ? <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Senha provisória</span>
                            : <span className="text-slate-500 font-medium">{u.funcionarioId === null ? 'Sem cadastro de colaborador' : (u.funcionarioStatus ?? 'Ativo')}</span>}
                        </td>
                        <td className="py-4 px-6 text-right">
                          {!isMe && (
                            <button
                              onClick={() => handleReset(u)}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title={`Redefinir a senha de ${u.nome}`}
                            >
                              <KeyRound size={16} />
                              <span>Redefinir senha</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="py-20 text-center text-slate-400 font-bold">Nenhum usuário encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loadError && !loading && (
        <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
          <span>{total === 0 ? 'Nenhum usuário' : `Página ${page} de ${pages} · ${total} usuários`}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => load(page - 1)} disabled={page <= 1} className="rounded-lg border border-slate-200 px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50">Anterior</button>
            <button type="button" onClick={() => load(page + 1)} disabled={page >= pages} className="rounded-lg border border-slate-200 px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50">Próxima</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
