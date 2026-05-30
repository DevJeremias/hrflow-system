import React from 'react';
import { CheckCircle2, TrendingUp, Clock } from 'lucide-react';

export default function Benefits() {
  const benefits = [
    {
      title: "Redução de 70% no operacional",
      desc: "Libere sua equipe de tarefas repetitivas e foque no desenvolvimento de talentos reais.",
      icon: <Clock size={32} />,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20"
    },
    {
      title: "Decisões baseadas em dados",
      desc: "Transforme números brutos em dashboards estratégicos que guiam o futuro da empresa.",
      icon: <TrendingUp size={32} />,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20"
    }
  ];

  return (
    <section className="relative py-32 bg-zinc-800 overflow-hidden" id="beneficios">
      
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10 rotate-180">
        <svg 
          viewBox="0 0 1200 120" 
          preserveAspectRatio="none" 
          className="relative block w-full h-[60px] md:h-[120px]"
        >
          <path 
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" 
            className="fill-slate-900" /* Esta cor faz a onda se fundir suavemente com a próxima seção (CommandCenter) */
          ></path>
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-20 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          
          <div className="space-y-8">
            <h2 className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-tight">
              Mais do que um software, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">
                seu novo braço direito.
              </span>
            </h2>
            <p className="text-xl text-zinc-400 font-medium leading-relaxed">
              Desenhamos uma experiência onde a complexidade é invisível. Tudo o que você vê é clareza, velocidade e precisão.
            </p>
            
            <div className="space-y-4 pt-4">
              {[
                "Integração bancária nativa para pagamentos",
                "Self-service para colaboradores (Portal do Funcionário)",
                "Histórico completo de evolução salarial e cargos"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 text-lg font-bold text-zinc-300">
                  <CheckCircle2 className="text-emerald-400" size={24} />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {benefits.map((benefit, i) => (
              <div key={i} className="group bg-zinc-900/40 p-10 md:p-14 rounded-[3rem] border border-zinc-700/50 hover:border-zinc-500 hover:bg-zinc-900/60 hover:shadow-2xl transition-all duration-500 backdrop-blur-sm">
                <div className={`${benefit.bg} ${benefit.color} ${benefit.border} border w-20 h-20 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-lg`}>
                  {benefit.icon}
                </div>
                <h3 className="text-3xl font-black text-white mb-4">{benefit.title}</h3>
                <p className="text-lg text-zinc-400 font-medium leading-relaxed">{benefit.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}