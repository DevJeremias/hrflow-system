import React from 'react';
import { Calculator, Users, ShieldCheck, DownloadCloud } from 'lucide-react';

export default function Features() {
  return (
    <section className="py-16  bg-white" id="funcionalidades">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="max-w-2xl mb-20">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">
            O poder de um ERP.<br />
            <span className="text-slate-400">A beleza de um app.</span>
          </h2>
          <p className="text-xl text-slate-500 font-medium">
            Desenhamos cada pixel do nosso sistema para que processos complexos de Departamento Pessoal sejam resolvidos com 2 cliques.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card Principal: Folha de Pagamento */}
          <div className="md:col-span-2 bg-[#f8fafc] rounded-[2rem] p-10 flex flex-col md:flex-row gap-8 items-center border border-slate-100 hover:border-indigo-200 transition-all group">
            <div className="flex-1">
              <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                <Calculator size={28} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4">Motor de Folha em Tempo Real</h3>
              <p className="text-slate-500 font-medium">
                Sabe os cálculos que você viu no dashboard? Eles são atualizados instantaneamente. Adicione uma hora extra e veja o IRRF e o INSS serem recalculados na hora.
              </p>
            </div>
            <div className="w-full md:w-64 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="h-4 w-1/2 bg-slate-200 rounded-full mb-3"></div>
              <div className="h-4 w-3/4 bg-slate-200 rounded-full mb-6"></div>
              <div className="h-10 w-full bg-emerald-50 rounded-xl border border-emerald-100 flex items-center px-4"><span className="text-emerald-600 font-bold text-sm">+ R$ 500,00 Bônus</span></div>
            </div>
          </div>

          {/* Card: Organograma */}
          <div className="bg-slate-900 rounded-[2rem] p-10 text-white flex flex-col justify-between border border-slate-800 hover:border-slate-700 transition-all">
            <div>
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400 mb-6">
                <Users size={28} />
              </div>
              <h3 className="text-2xl font-black mb-4">Estrutura Viva</h3>
              <p className="text-slate-400 font-medium">
                Crie departamentos, atrele líderes e visualize toda a cadeia hierárquica da sua empresa visualmente.
              </p>
            </div>
          </div>

          {/* Card: Exportação */}
          <div className="bg-rose-50 rounded-[2rem] p-10 border border-rose-100 hover:border-rose-200 transition-all">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-rose-500 mb-6 shadow-sm">
              <DownloadCloud size={24} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Exportação Contábil</h3>
            <p className="text-slate-500 text-sm font-medium">Gere PDFs de holerites em lote e relatórios prontos para o contador.</p>
          </div>

          {/* Card: Segurança */}
          <div className="md:col-span-2 bg-indigo-50 rounded-[2rem] p-10 border border-indigo-100 flex items-center gap-6">
            <div className="hidden md:flex w-24 h-24 bg-white rounded-full items-center justify-center text-indigo-600 shadow-sm flex-shrink-0">
              <ShieldCheck size={40} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Segurança Bancária</h3>
              <p className="text-slate-600 font-medium">Seus dados financeiros criptografados de ponta a ponta. Conformidade total com a LGPD e backups automáticos diários.</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}