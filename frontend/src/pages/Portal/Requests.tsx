import React, { useState } from 'react';
import { Calendar, Plus } from 'lucide-react';
import RequestsModal from '../../components/Portal/RequestsModal';
import RequestsTable from '../../components/Portal/RequestsTable';
import SaldoDeFerias from '../../components/SaldoDeFerias';
import { NewRequest } from '../../services/requestService';
import { useCriarSolicitacao, useMinhasSolicitacoes, useSaldoDeFerias } from '../../queries/solicitacoes';
import ErrorAlert from '../../components/ErrorAlert';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import Spinner from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toastContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { mensagemDeErro } from '../../utils/erros';

const Requests: React.FC = () => {
  usePageTitle('Minhas solicitações');
  const toast = useToast();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data, error, isPending, refetch } = useMinhasSolicitacoes();
  const { data: saldo } = useSaldoDeFerias(user?.funcionarioId ?? null);
  const criarSolicitacao = useCriarSolicitacao();
  const requests = data ?? [];
  const loading = isPending;
  const loadError = error ? mensagemDeErro(error, 'Erro ao buscar minhas solicitações') : null;

  const handleSubmitRequest = async (pedido: NewRequest) => {
    try {
      // A lista e o saldo voltam do servidor: nada é injetado no cache à mão.
      await criarSolicitacao.mutateAsync(pedido);
      setIsModalOpen(false);
      toast.success('Solicitação enviada ao RH.');
    } catch (error) {
      toast.error(mensagemDeErro(error, 'Erro ao enviar solicitação.'));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Minhas Solicitações"
        description="Peça férias, envie atestados ou solicite abonos ao RH e acompanhe a resposta."
        actions={<Button onClick={() => setIsModalOpen(true)} icon={<Plus size={20} aria-hidden="true" />}>Nova Solicitação</Button>}
      />

      {saldo && <SaldoDeFerias saldo={saldo} />}

      {loading ? (
        <div className="flex justify-center py-24 text-ink-muted"><Spinner size="lg" rotulo="Carregando solicitações..." /></div>
      ) : loadError ? (
        <ErrorAlert message={loadError} onRetry={() => { refetch(); }} />
      ) : requests.length > 0 ? (
        <RequestsTable requests={requests} />
      ) : (
        <EmptyState
          icon={<Calendar size={36} />}
          title="Nenhuma solicitação realizada"
          description="Você ainda não enviou nenhum documento ou pedido para aprovação."
          className="rounded-card border border-line bg-surface py-24 shadow-card"
        />
      )}

      <RequestsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitRequest}
        balance={saldo}
      />
    </div>
  );
};

export default Requests;
