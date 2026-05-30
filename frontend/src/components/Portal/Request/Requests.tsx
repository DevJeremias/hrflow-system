import React, { useState, useEffect } from 'react';
import { Plus, Umbrella, ClipboardList } from 'lucide-react';
import { requestService, EmployeeRequest } from '../../../services/requestService';
import RequestsHistoryTable from './RequestsHistory';
import NewRequestModal from './RequestModal';

const Requests: React.FC = () => {
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    const data = await requestService.getMyRequests();
    setRequests(data);
    setLoading(false);
  };

  const handleCreateRequest = async (formData: any) => {
    const newReq = await requestService.createRequest(formData);
    setRequests([newReq, ...requests]);
    setIsModalOpen(false);
  };

  const pendingCount = requests.filter(r => r.status === 'Pendente').length;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Solicitações ao RH</h1>
          <p className="text-slate-500 font-medium mt-1">Gerencie suas férias, licenças e atestados de forma digital.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 hover:bg-primary text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 shrink-0"
        >
          <Plus size={20} /> Nova Solicitação
        </button>
      </div>

      {/* Cards de Gestão */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Card: Saldo de Férias */}
        <div className="bg-gradient-to-br from-indigo-500 to-primary p-6 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center mb-6 border border-white/10 backdrop-blur-sm">
            <Umbrella size={24} />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-indigo-100 mb-1">Dias Disponíveis</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-black tracking-tighter">15</h3>
            <span className="font-bold text-indigo-200">dias de Férias</span>
          </div>
          <p className="text-xs font-medium text-indigo-200 mt-4">Vencimento: 10/12/2026</p>
        </div>

        {/* Card: Solicitações em Análise */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-6">
            <ClipboardList size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Em Análise pelo RH</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{pendingCount}</h3>
              <span className="font-bold text-slate-500">solicitações pendentes</span>
            </div>
          </div>
        </div>

      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div></div>
      ) : (
        <RequestsHistoryTable requests={requests} />
      )}

      {/* Modal */}
      <NewRequestModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleCreateRequest} 
      />

    </div>
  );
};

export default Requests;