import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Plus } from 'lucide-react';
import RequestsModal from '../../components/Portal/RequestsModal';
import RequestsTable from '../../components/Portal/RequestsTable';
import { requestService, RequestType } from '../../services/requestService';
import { useMinhasSolicitacoes } from '../../queries/solicitacoes';
import { chaves } from '../../queries/chaves';
import ErrorAlert from '../../components/ErrorAlert';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import Spinner from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toastContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { mensagemDeErro } from '../../utils/erros';

const Requests: React.FC = () => {
  usePageTitle('Minhas solicitações');
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data, error, isPending, refetch } = useMinhasSolicitacoes();
  const requests = data ?? [];
  const loading = isPending;
  const loadError = error ? mensagemDeErro(error, 'Erro ao buscar minhas solicitações') : null;

  const handleSubmitRequest = async (data: { type: RequestType; startDate: string; endDate: string; observation: string; hasAttachment: boolean }) => {
    try {
      await requestService.createRequest(data);
      // Em vez de injetar o objeto, o cache é invalidado e a lista volta do servidor
      await queryClient.invalidateQueries({ queryKey: chaves.solicitacoes });
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
        description="Envie atestados, solicite férias ou abonos diretamente ao RH."
        actions={<Button onClick={() => setIsModalOpen(true)} icon={<Plus size={20} aria-hidden="true" />}>Nova Solicitação</Button>}
      />

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
      />
    </div>
  );
};

export default Requests;
