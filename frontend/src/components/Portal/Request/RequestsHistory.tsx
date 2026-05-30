import React, { useState } from 'react';
import { FileText, Paperclip, Clock, CheckCircle2, XCircle, Filter } from 'lucide-react';
import { EmployeeRequest, RequestStatus, RequestType } from '../../../services/requestService';

interface Props {
  requests: EmployeeRequest[];
}

const RequestsHistory: React.FC<Props> = ({ requests }) => {
  const [filterStatus, setFilterStatus] = useState<RequestStatus | 'Todos'>('Todos');
  const [filterType, setFilterType] = useState<RequestType | 'Todos'>('Todos');

  const formatDate = (dateString: string) => dateString.split('-').reverse().join('/');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aprovada': return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-black rounded-full uppercase tracking-wider"><CheckCircle2 size={12}/> Aprovada</span>;
      case 'Recusada': return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 text-xs font-black rounded-full uppercase tracking-wider"><XCircle size={12}/> Recusada</span>;
      default: return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 text-xs font-black rounded-full uppercase tracking-wider"><Clock size={12}/> Pendente</span>;
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchStatus = filterStatus === 'Todos' || req.status === filterStatus;
    const matchType = filterType === 'Todos' || req.type === filterType;
    return matchStatus && matchType;
  });

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden mt-8">
      
      {/* Cabeçalho e Filtros */}
      <div className="px-8 py-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between bg-slate-50/50 gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-primary rounded-xl">
            <FileText size={20} />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Histórico de Solicitações</h2>
        </div>
        
        {/* Área de Filtros */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 text-slate-400 font-bold text-sm mr-2">
            <Filter size={16} />
            <span>Filtrar por:</span>
          </div>
          
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value as any)}
            className="w-full sm:w-48 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-primary transition-all cursor-pointer shadow-sm"
          >
            <option value="Todos">Todos os Tipos</option>
            <option value="Férias">Férias</option>
            <option value="Licença Médica">Licença Médica</option>
            <option value="Licença Maternidade">Licença Maternidade</option>
            <option value="Licença Paternidade">Licença Paternidade</option>
            <option value="Acidente de Trabalho">Acidente de Trabalho</option>
            <option value="Outros">Outros</option>
          </select>

          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="w-full sm:w-48 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-primary transition-all cursor-pointer shadow-sm"
          >
            <option value="Todos">Todos os Status</option>
            <option value="Pendente">Pendentes</option>
            <option value="Aprovada">Aprovadas</option>
            <option value="Recusada">Recusadas</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-white text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-100">
              <th className="p-6">Tipo / Data do Pedido</th>
              <th className="p-6">Período Solicitado</th>
              <th className="p-6">Observação</th>
              <th className="p-6 text-center">Anexo</th>
              <th className="p-6 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center">
                  <p className="text-slate-400 font-bold">Nenhuma solicitação encontrada para os filtros selecionados.</p>
                </td>
              </tr>
            ) : (
              filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                  <td className="p-6">
                    <p className="font-bold text-slate-900">{req.type}</p>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">Feito em {formatDate(req.requestDate)}</p>
                  </td>
                  <td className="p-6">
                    <p className="font-bold text-slate-700">
                      {formatDate(req.startDate)} <span className="text-slate-400 font-medium mx-1">até</span> {formatDate(req.endDate)}
                    </p>
                  </td>
                  <td className="p-6">
                    <p className="font-medium text-slate-500 truncate max-w-[250px]" title={req.observation}>
                      {req.observation}
                    </p>
                  </td>
                  <td className="p-6 text-center">
                    {req.hasAttachment ? (
                      <button className="p-2 hover:bg-slate-100 rounded-lg text-primary transition-colors inline-flex justify-center" title="Baixar Anexo">
                        <Paperclip size={18} />
                      </button>
                    ) : (
                      <span className="text-slate-300 font-bold">-</span>
                    )}
                  </td>
                  <td className="p-6 text-right">
                    {getStatusBadge(req.status)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RequestsHistory;