import React from 'react';
import { CheckCircle2, TrendingUp, Clock, Zap } from 'lucide-react';

export default function Benefits() {
  const benefits = [
    {
      title: "Redução de 70% no operacional",
      desc: "Libere sua equipe de tarefas repetitivas e foque no desenvolvimento de talentos reais.",
      icon: <Clock size={32} />,
      color: "text-indigo-600",
      bg: "bg-indigo-50"
    },
    {
      title: "Decisões baseadas em dados",
      desc: "Transforme números brutos em dashboards estratégicos que guiam o futuro da empresa.",
      icon: <TrendingUp size={32} />,
      color: "text-emerald-600",
      bg: "bg-emerald-50"
    }
  ];

  return (
    <section className="py-32 bg-white overflow-hidden" id="beneficios">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          
          <div className="space-y-8">
            <h2 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter leading-tight">
              Mais do que um software, <br />
              <span className="text-indigo-600">seu novo braço direito.</span>
            </h2>
            <p className="text-xl text-slate-500 font-medium leading-relaxed">
              Desenhamos uma experiência onde a complexidade é invisível. Tudo o que você vê é clareza, velocidade e precisão.
            </p>
            
            <div className="space-y-4 pt-4">
              {[
                "Integração bancária nativa para pagamentos",
                "Self-service para colaboradores (Portal do Funcionário)",
                "Histórico completo de evolução salarial e cargos"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 text-lg font-bold text-slate-700">
                  <CheckCircle2 className="text-emerald-500" size={24} />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {benefits.map((benefit, i) => (
              <div key={i} className="group bg-slate-50 p-10 md:p-14 rounded-[3rem] border border-slate-100 hover:border-indigo-200 hover:bg-white hover:shadow-2xl transition-all duration-500">
                <div className={`${benefit.bg} ${benefit.color} w-20 h-20 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                  {benefit.icon}
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-4">{benefit.title}</h3>
                <p className="text-lg text-slate-500 font-medium leading-relaxed">{benefit.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}