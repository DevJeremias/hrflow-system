import React, { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useDecidirPedido, usePedidosDaEmpresa } from '../../queries/solicitacoesAlteracao';
import type { PedidoDeAlteracao } from '../../services/solicitacoesAlteracaoService';
import PedidoDeAlteracaoCard from '../../components/Admin/PedidoDeAlteracaoCard';
import ErrorAlert from '../../components/ErrorAlert';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Field, { Textarea } from '../../components/ui/Field';
import Modal from '../../components/ui/Modal';
import Skeleton from '../../components/ui/Skeleton';
import Tabs, { TabPanel, type TabItem } from '../../components/ui/Tabs';
import { useConfirm } from '../../components/ui/confirmContext';
import { useToast } from '../../components/ui/toastContext';
import { mensagemDeErro } from '../../utils/erros';
import { usePageTitle } from '../../hooks/usePageTitle';

const PAGE_SIZE = 20;

type Aba = 'pendentes' | 'historico';

const ABAS: TabItem<Aba>[] = [
  { id: 'pendentes', label: 'Pendentes' },
  { id: 'historico', label: 'Histórico' },
];

// Os pedidos de alteração cadastral (nome, e-mail, endereço e dados bancários) que o colaborador fez e que
// esperam quem gere o cadastro: aprovar grava a mudança, recusar mantém tudo como está.
const Approvals: React.FC = () => {
  usePageTitle('Aprovações');
  const confirmar = useConfirm();
  const toast = useToast();
  const [aba, setAba] = useState<Aba>('pendentes');
  const [page, setPage] = useState(1);
  const [recusando, setRecusando] = useState<PedidoDeAlteracao | null>(null);
  const [motivo, setMotivo] = useState('');
  const [erroDaRecusa, setErroDaRecusa] = useState<string | null>(null);

  // O histórico traz todos os pedidos, do mais novo ao mais antigo, e só se lê: decidir é na aba de pendentes.
  const { data, error, isPending, refetch } = usePedidosDaEmpresa(aba === 'pendentes' ? 'pendente' : null, page, PAGE_SIZE);
  const decidir = useDecidirPedido();
  const pedidos = data?.pedidos ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loadError = error ? mensagemDeErro(error, 'Erro ao buscar as solicitações') : null;

  const mudarAba = (nova: Aba) => { setAba(nova); setPage(1); };

  const aprovar = async (pedido: PedidoDeAlteracao) => {
    const confirmado = await confirmar({
      title: `Aprovar o pedido de ${pedido.solicitante.nome}?`,
      description: 'As alterações passam a valer agora. Se o e-mail de acesso mudar, a pessoa será desconectada.',
      confirmLabel: 'Aprovar',
    });
    if (!confirmado) return;
    try {
      await decidir.mutateAsync({ id: pedido.id, decisao: { status: 'aprovada' } });
      toast.success(`Pedido de ${pedido.solicitante.nome} aprovado.`);
    } catch (err) {
      toast.error(mensagemDeErro(err, 'Erro ao aprovar o pedido.'));
    }
  };

  const fecharRecusa = () => {
    if (decidir.isPending) return;
    setRecusando(null);
    setMotivo('');
    setErroDaRecusa(null);
  };

  const recusar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recusando) return;
    setErroDaRecusa(null);
    try {
      await decidir.mutateAsync({ id: recusando.id, decisao: { status: 'recusada', ...(motivo.trim() ? { resposta: motivo.trim() } : {}) } });
      toast.success(`Pedido de ${recusando.solicitante.nome} recusado.`);
      setRecusando(null);
      setMotivo('');
    } catch (err) {
      setErroDaRecusa(mensagemDeErro(err, 'Erro ao recusar o pedido.'));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Aprovações"
        description="Pedidos de colaboradores para mudar nome, e-mail de acesso, endereço ou dados bancários."
      />

      <Tabs tabs={ABAS} value={aba} onChange={mudarAba} label="Situação dos pedidos" idPrefix="aprovacoes" variant="pill" />

      <TabPanel idPrefix="aprovacoes" id={aba}>
        {loadError ? (
          <ErrorAlert message={loadError} onRetry={() => { refetch(); }} />
        ) : isPending ? (
          <div className="space-y-4" role="status" aria-label="Carregando os pedidos">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : pedidos.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardCheck size={28} />}
              title={aba === 'pendentes' ? 'Nenhum pedido esperando decisão.' : 'Nenhum pedido registrado ainda.'}
              description={aba === 'pendentes' ? 'Quando alguém pedir uma alteração, ela aparece aqui.' : undefined}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {pedidos.map((pedido) => (
              <PedidoDeAlteracaoCard
                key={pedido.id}
                pedido={pedido}
                ocupado={decidir.isPending}
                onAprovar={aba === 'pendentes' ? aprovar : undefined}
                onRecusar={aba === 'pendentes' ? (p) => { setErroDaRecusa(null); setRecusando(p); } : undefined}
              />
            ))}
          </div>
        )}
      </TabPanel>

      {!loadError && !isPending && total > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-ink-muted">
          <span>Página {page} de {pages}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>Anterior</Button>
            <Button variant="secondary" size="sm" onClick={() => setPage(page + 1)} disabled={page >= pages}>Próxima</Button>
          </div>
        </div>
      )}

      {recusando && (
        <Modal
          title={`Recusar o pedido de ${recusando.solicitante.nome}`}
          size="sm"
          onClose={fecharRecusa}
          form={{ onSubmit: recusar }}
          footer={(
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={fecharRecusa} disabled={decidir.isPending}>Cancelar</Button>
              <Button type="submit" variant="danger" loading={decidir.isPending}>{decidir.isPending ? 'Recusando...' : 'Recusar pedido'}</Button>
            </div>
          )}
        >
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">Nada será alterado. A pessoa verá a sua resposta no perfil.</p>
            <Field label="Motivo da recusa" name="motivo" hint="Opcional, mas ajuda a pessoa a corrigir o pedido.">
              <Textarea data-autofocus rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </Field>
            {erroDaRecusa && <ErrorAlert message={erroDaRecusa} />}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Approvals;
