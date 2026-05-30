import React from 'react';

export default function Stats() {
  const stats = [
    { value: "R$ 2B+", label: "Em folhas processadas", desc: "Precisão matemática impecável" },
    { value: "10.000+", label: "Colaboradores geridos", desc: "Em mais de 500 empresas" },
    { value: "14h", label: "Economizadas por mês", desc: "Tempo devolvido ao RH" },
  ];

  return (
    <section className="bg-slate-900 text-white py-20 relative z-20 mt-[-50px] md:mt-[-100px] rounded-t-[3rem] shadow-2xl" id="metricas">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 divide-y md:divide-y-0 md:divide-x divide-white/10">
          {stats.map((stat, index) => (
            <div key={index} className="flex flex-col items-center text-center pt-8 md:pt-0 px-6">
              <h3 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50 tracking-tighter mb-2">
                {stat.value}
              </h3>
              <p className="text-lg font-bold text-indigo-400 mb-1">{stat.label}</p>
              <p className="text-sm font-medium text-slate-400">{stat.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}