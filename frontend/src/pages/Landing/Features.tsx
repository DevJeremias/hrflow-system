import React from 'react';
import { Calculator, Users, ShieldCheck, DownloadCloud } from 'lucide-react';

export default function Features() {
  return (
    <section className="py-16 bg-white" id="funcionalidades">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="max-w-2xl mb-20">
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-6">
            O poder de um ERP.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-purple-500">
              A beleza de um app.
            </span>
          </h2>
          <p className="text-xl text-gray-500 font-medium">
            Desenhamos cada pixel do nosso sistema para que processos complexos de Departamento Pessoal sejam resolvidos com 2 cliques.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-2 bg-gray-50 rounded-[2rem] p-10 flex flex-col md:flex-row gap-8 items-center border border-gray-100 hover:border-orange-200 hover:bg-white hover:shadow-xl transition-all duration-500 group">
            <div className="flex-1">
              <div className="w-14 h-14 bg-orange-50 text-orange-500 border border-orange-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-orange-500 group-hover:text-white transition-all shadow-sm">
                <Calculator size={28} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-4">Motor de Folha em Tempo Real</h3>
              <p className="text-gray-500 font-medium">
                Sabe os cálculos que você viu no dashboard? Eles são atualizados instantaneamente. Adicione uma hora extra e veja o IRRF e o INSS serem recalculados na hora.
              </p>
            </div>
            
            <div className="w-full md:w-64 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="h-4 w-1/2 bg-gray-100 rounded-full mb-3"></div>
              <div className="h-4 w-3/4 bg-gray-100 rounded-full mb-6"></div>
              <div className="h-10 w-full bg-green-50 rounded-xl border border-green-100 flex items-center px-4">
                <span className="text-green-600 font-bold text-sm">+ R$ 500,00 Bônus</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-[2rem] p-10 flex flex-col justify-between border border-gray-100 hover:border-purple-200 hover:bg-white hover:shadow-xl transition-all duration-500 group">
            <div>
              <div className="w-14 h-14 bg-purple-50 border border-purple-100 rounded-2xl flex items-center justify-center text-purple-500 mb-6 group-hover:scale-110 group-hover:bg-purple-500 group-hover:text-white transition-all shadow-sm">
                <Users size={28} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-4">Estrutura Viva</h3>
              <p className="text-gray-500 font-medium">
                Crie departamentos, atrele líderes e visualize toda a cadeia hierárquica da sua empresa visualmente.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-[2rem] p-10 border border-gray-100 hover:border-green-200 hover:bg-white hover:shadow-xl transition-all duration-500 group">
            <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center text-green-500 mb-6 group-hover:scale-110 group-hover:bg-green-500 group-hover:text-white transition-all shadow-sm">
              <DownloadCloud size={24} />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Exportação Contábil</h3>
            <p className="text-gray-500 text-sm font-medium">Gere PDFs de holerites em lote e relatórios prontos para o contador.</p>
          </div>

          <div className="md:col-span-2 bg-gray-50 rounded-[2rem] p-10 border border-gray-100 flex items-center gap-6 hover:border-orange-200 hover:bg-white hover:shadow-xl transition-all duration-500 group">
            <div className="hidden md:flex w-24 h-24 bg-orange-50 border border-orange-100 rounded-full items-center justify-center text-orange-500 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck size={40} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Segurança Bancária</h3>
              <p className="text-gray-500 font-medium">Seus dados financeiros criptografados de ponta a ponta. Conformidade total com a LGPD e backups automáticos diários.</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}