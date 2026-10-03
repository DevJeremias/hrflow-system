import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Plus } from 'lucide-react';
import RequestsModal from '../../components/Portal/RequestsModal';
import RequestsTable from '../../components/Portal/RequestsTable';
import { requestService, RequestType } from '../../services/requestService';
import { useMinhasSolicitacoes } from '../../queries/solicitacoes';
import { chaves } from '../../queries/chaves';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';

const Requests: React.FC = () => {
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
    } catch {
      alert('Erro ao enviar solicitação.');
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Minhas Solicitações</h1>
          <p className="text-slate-500 font-medium mt-1">Envie atestados, solicite férias ou abonos diretamente ao RH.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-slate-900 hover:bg-primary text-white font-bold py-3 px-6 rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-95"
        >
          <Plus size={20} />
          <span>Nova Solicitação</span>
        </button>
      </div>

      {/* Renderização Condicional: Tabela de Histórico ou Estado Vazio */}
      {loading ? (
        <div className="py-24 text-center text-slate-500 font-bold animate-pulse">Carregando solicitações...</div>
      ) : loadError ? (
        <ErrorAlert message={loadError} onRetry={() => { refetch(); }} />
      ) : requests.length > 0 ? (
        <RequestsTable requests={requests} />
      ) : (
        <div className="py-24 text-center flex flex-col items-center gap-4 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-2">
            <Calendar size={36} />
          </div>
          <div>
            <p className="text-slate-600 font-black text-xl">Nenhuma solicitação realizada</p>
            <p className="text-slate-400 font-medium mt-2">Você ainda não enviou nenhum documento ou pedido para aprovação.</p>
          </div>
        </div>
      )}

      {/* Componente de Modal Isolado */}
      <RequestsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleSubmitRequest} 
      />
      
    </div>
  );
};

export default Requests;