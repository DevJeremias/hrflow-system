import React, { useState } from 'react';
import { Plus, KeyRound, Users as UsersIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { AccessUser, NewUser } from '../../services/usersService';
import { useAlterarUsuario, useCriarUsuario, useUsuarios } from '../../queries/usuarios';
import UserModal from '../../components/Admin/UserModal';
import ProvisionalPasswordPanel from '../../components/Admin/ProvisionalPasswordPanel';
import ErrorAlert from '../../components/ErrorAlert';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Badge, { type BadgeTone } from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import DataTable, { type Column } from '../../components/ui/DataTable';
import EmptyState from '../../components/ui/EmptyState';
import { Select } from '../../components/ui/Field';
import { useConfirm } from '../../components/ui/confirmContext';
import { useToast } from '../../components/ui/toastContext';
import { mensagemDeErro } from '../../utils/erros';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PERFIS, Perfil } from '../../utils/sessao';

const PAGE_SIZE = 50;

const TOM_DO_PERFIL: Record<Perfil, BadgeTone> = {
  Administrador: 'brand',
  RH: 'info',
  Colaborador: 'neutral',
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
  usePageTitle('Usuários');
  const { user: me } = useAuth();
  const confirmar = useConfirm();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [delivery, setDelivery] = useState<Delivery | null>(null);

  // A página anterior fica na tela enquanto a nova chega: só o primeiro carregamento mostra o esqueleto.
  const { data, error, isPending, refetch } = useUsuarios(page, PAGE_SIZE);
  const criar = useCriarUsuario();
  const alterar = useAlterarUsuario();
  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const loading = isPending;
  const loadError = error ? mensagemDeErro(error, 'Erro ao buscar usuários') : null;

  // O erro sobe até o modal, que o mostra junto ao formulário e mantém o que foi digitado.
  const handleCreate = async (novo: NewUser) => {
    const { user, senhaProvisoria } = await criar.mutateAsync(novo);
    if (senhaProvisoria) setDelivery({ nome: user.nome, email: user.email, senha: senhaProvisoria });
  };

  const handleProfile = async (target: AccessUser, perfil: Perfil) => {
    if (perfil === target.perfil) return;
    const confirmado = await confirmar({
      title: `Mudar o perfil de ${target.nome} para ${perfil}?`,
      description: 'A pessoa precisará entrar de novo.',
      confirmLabel: 'Mudar perfil',
    });
    if (!confirmado) return;
    try {
      await alterar.mutateAsync({ id: target.id, mudanca: { perfil } });
      toast.success(`Perfil de ${target.nome} alterado para ${perfil}.`);
    } catch (error) {
      toast.error(mensagemDeErro(error, 'Erro ao alterar o perfil.'));
    }
  };

  const handleReset = async (target: AccessUser) => {
    const confirmado = await confirmar({
      title: `Redefinir a senha de ${target.nome}?`,
      description: 'A senha atual deixa de valer e a pessoa será desconectada.',
      confirmLabel: 'Redefinir senha',
      tone: 'danger',
    });
    if (!confirmado) return;
    try {
      const { senhaProvisoria } = await alterar.mutateAsync({ id: target.id, mudanca: { redefinirSenha: true } });
      if (senhaProvisoria) setDelivery({ nome: target.nome, email: target.email, senha: senhaProvisoria });
    } catch (error) {
      toast.error(mensagemDeErro(error, 'Erro ao redefinir a senha.'));
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Column<AccessUser>[] = [
    {
      key: 'usuario',
      header: 'Usuário',
      semRotuloNoCartao: true,
      cell: (u) => (
        <>
          <span className="block font-semibold text-ink">{u.nome}{u.id === me?.id && <span className="ml-2 text-xs font-semibold text-ink-muted">(você)</span>}</span>
          <span className="block break-all text-xs text-ink-muted">{u.email}</span>
        </>
      ),
    },
    {
      key: 'perfil',
      header: 'Perfil',
      cell: (u) => (u.id === me?.id ? (
        <Badge tone={TOM_DO_PERFIL[u.perfil]}>{u.perfil}</Badge>
      ) : (
        <Select
          name={`perfil-${u.id}`}
          aria-label={`Perfil de ${u.nome}`}
          value={u.perfil}
          onChange={(e) => handleProfile(u, e.target.value as Perfil)}
          className="h-9 w-auto min-w-36"
        >
          {profilesFor(u).map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
      )),
    },
    {
      key: 'situacao',
      header: 'Situação',
      cell: (u) => (u.senhaProvisoria
        ? <Badge tone="warning">Senha provisória</Badge>
        : <span className="text-ink-muted">{u.funcionarioId === null ? 'Sem cadastro de colaborador' : (u.funcionarioStatus ?? 'Ativo')}</span>),
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      semRotuloNoCartao: true,
      cell: (u) => (u.id === me?.id ? null : (
        <Button variant="ghost" size="sm" icon={<KeyRound size={16} aria-hidden="true" />} onClick={() => handleReset(u)} title={`Redefinir a senha de ${u.nome}`}>
          Redefinir senha
          <span className="sr-only"> de {u.nome}</span>
        </Button>
      )),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <UserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleCreate} />

      <PageHeader
        title="Usuários"
        description="Quem acessa o sistema e com qual perfil. Colaboradores nascem no cadastro de colaboradores."
        actions={<Button size="lg" icon={<Plus size={20} aria-hidden="true" />} onClick={() => setIsModalOpen(true)}>Novo usuário</Button>}
      />

      {delivery && <ProvisionalPasswordPanel {...delivery} onClose={() => setDelivery(null)} />}
      {loadError && <ErrorAlert message={loadError} onRetry={() => { refetch(); }} />}

      {!loadError && (
        <DataTable
          caption="Usuários com acesso ao sistema"
          columns={columns}
          rows={users}
          rowKey={(u) => u.id}
          loading={loading}
          loadingRows={3}
          className="rounded-card md:border md:border-line md:bg-surface md:shadow-card"
          empty={<Card><EmptyState icon={<UsersIcon size={28} />} title="Nenhum usuário encontrado." /></Card>}
        />
      )}

      {!loadError && !loading && (
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-ink-muted">
          <span>{total === 0 ? 'Nenhum usuário' : `Página ${page} de ${pages} · ${total} usuários`}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>Anterior</Button>
            <Button variant="secondary" size="sm" onClick={() => setPage(page + 1)} disabled={page >= pages}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
