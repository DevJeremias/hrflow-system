import React from 'react';
import { Cog, Network, Database, CheckCircle2 } from 'lucide-react';

export default function AnatomySection() {
  return (
    <section className="relative py-32 bg-zinc-800 overflow-hidden" id="evidencia">
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-none z-10">
        <svg 
          viewBox="0 0 1200 120" 
          preserveAspectRatio="none" 
          className="relative block w-full h-[60px] md:h-[120px]"
        >
          <path 
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" 
            className="fill-slate-900" 
          ></path>
        </svg>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 relative z-20 pt-20">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          <div className="relative group perspective-1000 order-2 lg:order-1 flex justify-center">
            
            <div className="absolute -left-6 md:-left-12 -top-10 w-[250px] h-[250px] md:w-[350px] md:h-[350px] bg-orange-600 rounded-full z-0 opacity-100 shadow-xl group-hover:scale-105 transition-transform duration-700"></div>
            
            <div className="absolute -bottom-10 -right-4 md:-right-8 w-32 h-32 md:w-48 md:h-48 bg-zinc-700 rounded-full z-0 opacity-50 group-hover:scale-110 transition-transform duration-1000"></div>

            <div className="relative z-10 transform-gpu rotate-y-[-5deg] rotate-x-[2deg] group-hover:rotate-0 group-hover:scale-[1.02] transition-all duration-1000 ease-out w-full max-w-2xl">
              <div className="p-2 bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-zinc-700 backdrop-blur-sm">
                <img 
                  src="/hero_imagem.avif" 
                  alt="Interface do Sistema RHPRO" 
                  className="w-full h-auto rounded-[2rem] object-cover opacity-95"
                />
              </div>

              <div className="absolute -bottom-6 -right-6 bg-slate-950 text-white p-6 rounded-3xl shadow-[0_10px_30px_-5px_rgba(0,0,0,0.5)] animate-float-slow hidden md:block border border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Motor de Cálculo</p>
                    <p className="text-lg font-bold text-white">100% Ativo</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-12 order-1 lg:order-2">
            <div className="space-y-6">
              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-[0.9] lg:max-w-md">
                Anatomia da <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">
                  Eficiência.
                </span>
              </h2>
              <p className="text-xl text-zinc-400 font-medium leading-relaxed max-w-lg">
                Entenda como nossa interface converte dados brutos de folha em clareza estratégica e velocidade operacional. Tudo pensado para o seu conforto.
              </p>
            </div>

            <div className="space-y-8 border-t border-zinc-700 pt-10">
              <h3 className="text-2xl font-black text-white">Tudo isso a 1 clique de distância.</h3>
              
              <div className="grid grid-cols-1 gap-4">
                {[
                  { icon: <Cog size={20} />, title: "Configuração Rápida", desc: "Faça o setup de regras e departamentos em minutos." },
                  { icon: <Network size={20} />, title: "Custo Centralizado", desc: "Visualize o custo consolidado de cada DP instantaneamente." },
                  { icon: <Database size={20} />, title: "Segurança de Dados", desc: "Conformidade LGPD nativa e criptografia de ponta." }
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-5 p-6 rounded-3xl border border-zinc-700/50 hover:bg-zinc-900/40 hover:border-zinc-500 transition-all group backdrop-blur-sm">
                    <div className="p-3 bg-zinc-950 shadow-sm text-orange-500 rounded-xl group-hover:bg-orange-500 group-hover:text-white transition-colors border border-zinc-800 group-hover:border-orange-500">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1">{item.title}</h4>
                      <p className="text-sm text-zinc-400 font-medium">{item.desc}</p>
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