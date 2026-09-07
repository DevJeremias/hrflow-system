import React, { useState } from 'react';
import { Clock, Search, Filter, Calendar as CalendarIcon, CheckCircle2, XCircle } from 'lucide-react';

interface RegistroPonto {
  id: number;
  funcionario: string;
  departamento: string;
  data: string;
  entrada: string;
  saida: string | null;
  status: 'Regular' | 'Inconsistente';
}

export default function TimeTracking() {
  const [searchTerm, setSearchTerm] = useState('');

  // Dados fictícios para a interface não nascer vazia enquanto não ligamos o back-end
  const [registros] = useState<RegistroPonto[]>([
    { id: 1, funcionario: 'Henrique Jeremias', departamento: 'Engenharia', data: '2026-06-12', entrada: '08:00', saida: '17:00', status: 'Regular' },
    { id: 2, funcionario: 'Yuri Silva', departamento: 'Engenharia', data: '2026-06-12', entrada: '08:15', saida: null, status: 'Inconsistente' },
    { id: 3, funcionario: 'Marcos', departamento: 'Infraestrutura', data: '2026-06-12', entrada: '07:55', saida: '17:05', status: 'Regular' },
  ]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Gestão de Ponto</h1>
          <p className="text-slate-500 font-medium mt-1">Monitore as entradas e saídas dos colaboradores em tempo real.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm">
            <CalendarIcon size={18} />
            <span>Este Mês</span>
          </button>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30">
            <Clock size={18} />
            <span>Relatório de Ponto</span>
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Clock size={28} />
          </div>
          <div>
            <p className="text-slate-500 font-bold text-sm">Registros Hoje</p>
            <h3 className="text-2xl font-black text-slate-800">142</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <p className="text-slate-500 font-bold text-sm">Pontos Regulares</p>
            <h3 className="text-2xl font-black text-slate-800">138</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <XCircle size={28} />
          </div>
          <div>
            <p className="text-slate-500 font-bold text-sm">Inconsistências</p>
            <h3 className="text-2xl font-black text-slate-800">4</h3>
          </div>
        </div>
      </div>

      {/* Tabela de Registros */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        
        {/* Filtros da Tabela */}
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar colaborador..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <button className="flex items-center gap-2 text-slate-600 font-bold hover:text-indigo-600 transition-colors px-4 py-2">
            <Filter size={20} />
            <span>Filtros Avançados</span>
          </button>
        </div>

        {/* Corpo da Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm uppercase tracking-wider font-bold">
                <th className="p-5 font-bold">Colaborador</th>
                <th className="p-5 font-bold">Departamento</th>
                <th className="p-5 font-bold">Data</th>
                <th className="p-5 font-bold">Entrada</th>
                <th className="p-5 font-bold">Saída</th>
                <th className="p-5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registros.map((registro) => (
                <tr key={registro.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-5">
                    <p className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{registro.funcionario}</p>
                  </td>
                  <td className="p-5 font-medium text-slate-600">{registro.departamento}</td>
                  <td className="p-5 font-medium text-slate-600">{registro.data}</td>
                  <td className="p-5 font-bold text-slate-700">{registro.entrada}</td>
                  <td className="p-5 font-bold text-slate-700">{registro.saida || '--:--'}</td>
                  <td className="p-5">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                      registro.status === 'Regular' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {registro.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}