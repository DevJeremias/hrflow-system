import React, { useState, useEffect } from 'react';
import { Calendar, Plus } from 'lucide-react';
import RequestsModal from '../../components/Portal/RequestsModal';
import RequestsTable from '../../components/Portal/RequestsTable';
import { requestService, EmployeeRequest, RequestType } from '../../services/requestService';
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
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    setReloadKey((k) => k + 1);
  };

  // Busca o histórico de solicitações do colaborador
  useEffect(() => {
    requestService.getMyRequests()
      .then(setRequests)
      .catch((error) => setLoadError(mensagemDeErro(error, 'Erro ao buscar minhas solicitações')))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  const handleSubmitRequest = async (data: { type: RequestType; startDate: string; endDate: string; observation: string; hasAttachment: boolean }) => {
    try {
      await requestService.createRequest(data);
      // Em vez de injetar o objeto, recarregamos a lista atualizada do servidor
      const updatedRequests = await requestService.getMyRequests();
      setRequests(updatedRequests);
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
        <ErrorAlert message={loadError} onRetry={retry} />
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
