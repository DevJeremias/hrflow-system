import { CheckCircle2, TrendingUp, Clock } from 'lucide-react';

export default function Benefits() {
  const benefits = [
    {
      title: "Menos planilhas soltas",
      desc: "Colaboradores, cargos, ponto e folha ficam no mesmo cadastro, em vez de espalhados em arquivos diferentes.",
      icon: <Clock size={32} />,
      color: "text-brand group-hover:text-brand-foreground",
      bg: "bg-brand-soft group-hover:bg-brand-fill",
      border: "border-brand-line group-hover:border-brand-fill"
    },
    {
      title: "Visão geral para o RH",
      desc: "Um painel mostra quantos colaboradores, departamentos e cargos existem e quais solicitações aguardam aprovação.",
      icon: <TrendingUp size={32} />,
      color: "text-success group-hover:text-brand-foreground",
      bg: "bg-success-soft group-hover:bg-brand-fill",
      border: "border-success-line group-hover:border-brand-fill"
    }
  ];

  return (
    <section className="relative overflow-hidden bg-surface-muted py-20 sm:py-24" id="beneficios">
      
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10 rotate-180">
        <svg 
          viewBox="0 0 1200 120" 
          preserveAspectRatio="none" 
          className="relative block w-full h-[60px] md:h-[120px]"
        >
          <path 
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" 
            className="fill-surface"
          ></path>
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-20 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          
          <div className="space-y-8">
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">
              Mais do que um software, <br />
              <span className="text-brand">
                seu novo braço direito.
              </span>
            </h2>
            <p className="text-xl text-ink-muted font-medium leading-relaxed">
              Uma interface direta para as rotinas de RH do dia a dia, sem módulos que você não vai usar.
            </p>
            
            <div className="space-y-4 pt-4">
              {[
                "Cadastro com dados pessoais, contratuais e bancários",
                "Registro de ponto pelo próprio colaborador",
                "Portal do colaborador com holerites e solicitações"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 font-semibold text-ink">
                  <CheckCircle2 className="text-success" size={24} />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {benefits.map((benefit, i) => (
              <div key={i} className="group rounded-card border border-line bg-surface p-6 shadow-card transition-shadow hover:shadow-raised sm:p-8">
                <div className={`${benefit.bg} ${benefit.color} ${benefit.border} border w-20 h-20 rounded-card flex items-center justify-center mb-8 group-hover:scale-110 transition-all duration-300 shadow-card`}>
                  {benefit.icon}
                </div>
                <h3 className="mb-4 text-2xl font-bold text-ink">{benefit.title}</h3>
                <p className="leading-relaxed text-ink-muted">{benefit.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}