import React, { useState, useEffect } from 'react';
import { Users, Briefcase, Calendar as CalendarIcon, FileText, ArrowRight, Plus, PieChart, LineChart } from 'lucide-react';
import { useAuth } from '../../../src/contexts/AuthContext';
import { dashboardService, DashboardData } from '../../../src/services/dashboardService';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const firstName = user?.nome?.split(' ')[0] || 'Gestor';
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    dashboardService.getDashboardData().then(res => {
      setData(res);
      setIsLoading(false);
    });
  }, []);

  const stats = [
    { label: 'Total de Colaboradores', value: '124', trend: '+ 5%', isPositive: true, icon: <Users className="text-blue-500" />, bg: 'bg-blue-50' },
    { label: 'Vagas em Aberto', value: '8', trend: '+ 2%', isPositive: true, icon: <Briefcase className="text-orange-500" />, bg: 'bg-orange-50' },
    { label: 'Férias Pendentes', value: '12', trend: '- 3%', isPositive: false, icon: <CalendarIcon className="text-indigo-500" />, bg: 'bg-indigo-50' },
    { label: 'Contratos a Vencer', value: '6', trend: '- 40%', isPositive: false, icon: <FileText className="text-emerald-500" />, bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* LINHA 1: Saudação, Cards e Banner (Exatamente como na Imagem 1) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Bloco Esquerdo: Saudação + 4 Cards */}
        <div className="xl:col-span-3 space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black text-slate-900">Olá, {firstName}!</h1>
              <p className="text-slate-500 mt-1">Aqui está um resumo da sua equipa e das principais informações do RH.</p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-slate-500 text-sm font-bold bg-white p-3 rounded-xl shadow-sm border border-slate-100">
              <CalendarIcon size={18} />
              <span>Seg, 23 de Jun de 2026</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${stat.bg}`}>
                  {stat.icon}
                </div>
                <p className="text-sm font-bold text-slate-700">{stat.label}</p>
                <h3 className="text-3xl font-black text-slate-900 mt-1">{stat.value}</h3>
                <p className={`text-xs font-bold mt-2 ${stat.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {stat.trend} <span className="text-slate-400 font-normal">em relação ao mês anterior</span>
                </p>
                <div className="absolute top-4 right-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-primary">
                  <ArrowRight size={16} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bloco Direito: Banner Promocional Escuro */}
        <div className="bg-secondary rounded-2xl p-8 text-white relative overflow-hidden shadow-xl flex flex-col justify-center">
          <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-primary rounded-full blur-3xl opacity-50"></div>
          <h2 className="text-2xl font-black mb-3 relative z-10 leading-tight">Juntos por<br/>um ambiente de<br/>trabalho melhor!</h2>
          <p className="text-sm text-slate-300 mb-6 relative z-10 opacity-90">Tecnologia, pessoas e processos lado a lado.</p>
          <button className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold py-3 px-6 rounded-xl w-max transition-colors relative z-10 flex items-center gap-2">
            Ver relatórios <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* LINHA 2: Gráficos e Ações Rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900">Evolução do Quadro de Colaboradores</h3>
            <select className="bg-slate-50 border border-slate-200 text-sm rounded-lg p-2 outline-none">
              <option>Últimos 6 meses</option>
            </select>
          </div>
          <div className="h-48 w-full bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-dashed border-slate-200">
             {/* Placeholder para Biblioteca de Gráficos (Ex: Recharts) */}
             <LineChart size={32} />
             <span className="ml-2 font-medium">Gráfico de Linha em breve</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">Distribuição por Departamento</h3>
          <div className="h-48 w-full flex items-center justify-center text-slate-400">
             <PieChart size={64} className="text-slate-200" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <h3 className="font-bold text-slate-900 mb-4">Ações Rápidas</h3>
          <div className="space-y-3">
            {[
              { icon: <Plus size={18} />, label: 'Adicionar colaborador', bg: 'bg-secondary text-white' },
              { icon: <Briefcase size={18} />, label: 'Cadastrar vaga', bg: 'bg-slate-100 text-slate-700' },
              { icon: <CalendarIcon size={18} />, label: 'Solicitar férias', bg: 'bg-secondary text-white' },
            ].map((action, idx) => (
              <button key={idx} className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-primary transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${action.bg}`}>{action.icon}</div>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-primary">{action.label}</span>
                </div>
                <ArrowRight size={16} className="text-slate-300" />
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;