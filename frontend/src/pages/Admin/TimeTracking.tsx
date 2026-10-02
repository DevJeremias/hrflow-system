import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Search, Calendar as CalendarIcon, Users } from 'lucide-react';
import { pontoService, type CompanyPointRecord } from '../../services/pontoService';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';

const mesAtualEmBelem = (): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Belem',
  year: 'numeric',
  month: '2-digit'
}).format(new Date()).slice(0, 7);

export default function TimeTracking() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registros, setRegistros] = useState<CompanyPointRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState(mesAtualEmBelem);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ativo = true;
    pontoService.getRegistrosDaEmpresa()
      .then((dados) => { if (ativo) setRegistros(dados); })
      .catch((error) => {
        if (!ativo) return;
        setRegistros([]);
        setLoadError(mensagemDeErro(error, 'Erro ao buscar os registros de ponto'));
      })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [reloadKey]);

  const registrosFiltrados = useMemo(() => {
    const termo = searchTerm.trim().toLocaleLowerCase('pt-BR');
    return registros.filter((registro) =>
      registro.date.startsWith(monthFilter)
      && registro.nome_funcionario.toLocaleLowerCase('pt-BR').includes(termo)
    );
  }, [registros, searchTerm, monthFilter]);

  const colaboradores = new Set(registrosFiltrados.map((registro) => registro.funcionario_id)).size;
  const diasMonitorados = new Set(registrosFiltrados.map((registro) => registro.date)).size;
  const retry = () => {
    setLoading(true);
    setLoadError(null);
    setReloadKey((key) => key + 1);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Gestão de Ponto</h1>
          <p className="text-slate-500 font-medium mt-1">Consulte as marcações reais de ponto dos colaboradores.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold shadow-sm">
            <CalendarIcon size={18} />
            <span className="sr-only">Mês de referência</span>
            <input aria-label="Mês de referência" type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="bg-transparent outline-none" />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard label="Marcações no mês" value={loading || loadError ? '—' : registrosFiltrados.length} icon={<Clock size={28} />} color="indigo" />
        <SummaryCard label="Colaboradores com ponto" value={loading || loadError ? '—' : colaboradores} icon={<Users size={28} />} color="emerald" />
        <SummaryCard label="Dias com marcação" value={loading || loadError ? '—' : diasMonitorados} icon={<CalendarIcon size={28} />} color="rose" />
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="search"
              placeholder="Buscar colaborador..."
              aria-label="Buscar colaborador"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <p className="text-sm font-medium text-slate-500">Dados limitados à empresa da sua sessão.</p>
        </div>

        {loading ? (
          <div role="status" className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
            <p className="font-bold">Carregando registros de ponto...</p>
          </div>
        ) : loadError ? (
          <div className="p-6"><ErrorAlert message={loadError} onRetry={retry} /></div>
        ) : registrosFiltrados.length === 0 ? (
          <p className="py-16 text-center font-medium text-slate-500">Nenhum registro de ponto encontrado neste mês.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm uppercase tracking-wider font-bold">
                  <th className="p-5">Colaborador</th>
                  <th className="p-5">Data</th>
                  <th className="p-5">Marcação</th>
                  <th className="p-5">Horário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registrosFiltrados.map((registro) => (
                  <tr key={registro.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-5 font-bold text-slate-800">{registro.nome_funcionario}</td>
                    <td className="p-5 font-medium text-slate-600">{registro.date}</td>
                    <td className="p-5 font-medium text-slate-600">{registro.tipo_registro}</td>
                    <td className="p-5 font-bold text-slate-700">{registro.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'indigo' | 'emerald' | 'rose';
}

function SummaryCard({ label, value, icon, color }: SummaryCardProps) {
  const styles = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600'
  };
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${styles[color]}`}>{icon}</div>
      <div>
        <p className="text-slate-500 font-bold text-sm">{label}</p>
        <h3 className="text-2xl font-black text-slate-800">{value}</h3>
      </div>
    </div>
  );
}
