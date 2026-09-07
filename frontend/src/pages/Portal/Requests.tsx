import React, { useState, useEffect } from 'react';
import { Calendar, Plus } from 'lucide-react';
import RequestsModal from '../../components/Portal/RequestsModal';
import RequestsTable from '../../components/Portal/RequestsTable';
import { requestService, EmployeeRequest, RequestType } from '../../services/requestService';

const Requests: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Busca o histórico de solicitações do colaborador ao carregar a página
    const fetchRequests = async () => {
      try {
        const data = await requestService.getMyRequests(); 
        setRequests(data);
      } catch (error) {
        console.error('Erro ao buscar solicitações', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  const handleSubmitRequest = async (data: { type: RequestType; startDate: string; endDate: string; observation: string; hasAttachment: boolean }) => {
    try {
      await requestService.createRequest(data); 
      // Em vez de injetar o objeto, recarregamos a lista atualizada do servidor
      const updatedRequests = await requestService.getMyRequests(); 
      setRequests(updatedRequests);
      setIsModalOpen(false); 
    } catch (error) {
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