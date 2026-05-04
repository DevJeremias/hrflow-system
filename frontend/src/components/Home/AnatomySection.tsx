import React from 'react';
import { Cog, Network, Database, CheckCircle2 } from 'lucide-react';

export default function AnatomySection() {
  return (
    <section className="py-32 bg-white overflow-hidden" id="evidencia">
      <div className="max-w-[1440px] mx-auto px-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          <div className="relative group perspective-1000 order-2 lg:order-1">
            <div className="absolute -inset-4 bg-indigo-500/5 blur-3xl rounded-[3rem] group-hover:bg-indigo-500/10 transition-colors duration-700" />
            
            <div className="relative transform-gpu rotate-y-[-5deg] rotate-x-[2deg] group-hover:rotate-0 group-hover:scale-[1.02] transition-all duration-1000 ease-out">
              <div className="p-2 bg-white rounded-[2.5rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.12)] border border-slate-100">
                <img 
                  src="/hero_imagem.avif" 
                  alt="Interface do Sistema RHPRO" 
                  className="w-full h-auto rounded-[2rem] object-cover"
                />
              </div>

              <div className="absolute -bottom-6 -right-6 bg-slate-900 text-white p-6 rounded-3xl shadow-2xl animate-float-slow hidden md:block">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motor de Cálculo</p>
                    <p className="text-lg font-bold">100% Ativo</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-12 order-1 lg:order-2">
            <div className="space-y-6">
              <h2 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-[0.9] lg:max-w-md">
                Anatomia da <br />
                <span className="text-indigo-600">Eficiência.</span>
              </h2>
              <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-lg">
                Entenda como nossa interface converte dados brutos de folha em clareza estratégica e velocidade operacional. Tudo pensado para o seu conforto.
              </p>
            </div>

            <div className="space-y-8 border-t border-slate-100 pt-10">
              <h3 className="text-2xl font-black text-slate-900">Tudo isso a 1 clique de distância.</h3>
              
              <div className="grid grid-cols-1 gap-4">
                {[
                  { 
                    icon: <Cog size={20} />, 
                    title: "Configuração Rápida", 
                    desc: "Faça o setup de regras e departamentos em minutos." 
                  },
                  { 
                    icon: <Network size={20} />, 
                    title: "Custo Centralizado", 
                    desc: "Visualize o custo consolidado de cada DP instantaneamente." 
                  },
                  { 
                    icon: <Database size={20} />, 
                    title: "Segurança de Dados", 
                    desc: "Conformidade LGPD nativa e criptografia de ponta." 
                  }
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-5 p-6 rounded-3xl border border-slate-50 hover:bg-slate-50 transition-all group">
                    <div className="p-3 bg-white shadow-sm text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                      <p className="text-sm text-slate-500 font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}   