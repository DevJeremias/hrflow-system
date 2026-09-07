import React from 'react';
import { Cog, Network, Database, CheckCircle2 } from 'lucide-react';

export default function AnatomySection() {
  return (
    <section className="relative py-32 bg-slate-300 overflow-hidden" id="evidencia">
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-none z-10">
        <svg 
          viewBox="0 0 1200 120" 
          preserveAspectRatio="none" 
          className="relative block w-full h-[60px] md:h-[120px]"
        >
          <path 
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" 
            className="fill-slate-50" 
          ></path>
        </svg>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 relative z-20 pt-20">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          <div className="relative group perspective-1000 order-2 lg:order-1 flex justify-center">
            
            <div className="absolute -left-6 md:-left-12 -top-10 w-[250px] h-[250px] md:w-[350px] md:h-[350px] bg-orange-200 rounded-full z-0 opacity-80 shadow-lg group-hover:scale-105 transition-transform duration-700"></div>
            
            <div className="absolute -bottom-10 -right-4 md:-right-8 w-32 h-32 md:w-48 md:h-48 bg-purple-200 rounded-full z-0 opacity-80 group-hover:scale-110 transition-transform duration-1000"></div>

            <div className="relative z-10 transform-gpu rotate-y-[-5deg] rotate-x-[2deg] group-hover:rotate-0 group-hover:scale-[1.02] transition-all duration-1000 ease-out w-full max-w-2xl">
              <div className="p-2 bg-white rounded-[2.5rem] shadow-xl border border-slate-200 backdrop-blur-sm">
                <img 
                  src="./src/assets/hero_imagem.avif" 
                  alt="Interface do Sistema RHPRO" 
                  className="w-full h-auto rounded-[2rem] object-cover opacity-95"
                />
              </div>

              <div className="absolute -bottom-6 -right-6 bg-white text-slate-900 p-6 rounded-3xl shadow-[0_10px_30px_-5px_rgba(0,0,0,0.1)] animate-float-slow hidden md:block border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center border border-green-200">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motor de Cálculo</p>
                    <p className="text-lg font-bold text-slate-900">100% Ativo</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-12 order-1 lg:order-2">
            <div className="space-y-6">
              <h2 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-[0.9] lg:max-w-md">
                Anatomia da <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-purple-600">
                  Eficiência.
                </span>
              </h2>
              <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-lg">
                Entenda como nossa interface converte dados brutos de folha em clareza estratégica e velocidade operacional. Tudo pensado para o seu conforto.
              </p>
            </div>

            <div className="space-y-8 border-t border-slate-200 pt-10">
              <h3 className="text-2xl font-black text-slate-900">Tudo isso a 1 clique de distância.</h3>
              
              <div className="grid grid-cols-1 gap-4">
                {[
                  { 
                    icon: <Cog size={20} />, 
                    title: "Configuração Rápida", 
                    desc: "Faça o setup de regras e departamentos em minutos.",
                    colorClasses: "text-orange-500 bg-orange-50 border-orange-100 group-hover:bg-orange-500 group-hover:text-white"
                  },
                  { 
                    icon: <Network size={20} />, 
                    title: "Custo Centralizado", 
                    desc: "Visualize o custo consolidado de cada DP instantaneamente.",
                    colorClasses: "text-purple-500 bg-purple-50 border-purple-100 group-hover:bg-purple-500 group-hover:text-white"
                  },
                  { 
                    icon: <Database size={20} />, 
                    title: "Segurança de Dados", 
                    desc: "Conformidade LGPD nativa e criptografia de ponta.",
                    colorClasses: "text-green-500 bg-green-50 border-green-100 group-hover:bg-green-500 group-hover:text-white"
                  }
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-5 p-6 rounded-3xl border border-slate-200 bg-white hover:border-slate-300 transition-all group shadow-sm hover:shadow-md">
                    <div className={`p-3 rounded-xl transition-all duration-300 border ${item.colorClasses}`}>
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