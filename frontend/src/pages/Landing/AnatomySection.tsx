import { Cog, Network, Database, CheckCircle2 } from 'lucide-react';
import heroImagem from '../../assets/hero_imagem.avif';

export default function AnatomySection() {
  return (
    <section className="relative overflow-hidden bg-surface-muted py-20 sm:py-24" id="evidencia">
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-none z-10">
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

      <div className="max-w-[1440px] mx-auto px-6 relative z-20 pt-20">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          <div className="relative group perspective-1000 order-2 lg:order-1 flex justify-center">
            
            <div className="absolute -left-6 -top-10 z-0 h-64 w-64 rounded-full bg-brand-soft opacity-80 shadow-raised transition-transform duration-700 group-hover:scale-105 md:-left-12 md:h-80 md:w-80"></div>
            
            <div className="absolute -bottom-10 -right-4 z-0 h-32 w-32 rounded-full bg-brand-soft opacity-80 transition-transform duration-1000 group-hover:scale-110 md:-right-8 md:h-48 md:w-48"></div>

            <div className="relative z-10 transform-gpu rotate-y-[-5deg] rotate-x-[2deg] group-hover:rotate-0 group-hover:scale-[1.02] transition-all duration-1000 ease-out w-full max-w-2xl">
              <div className="rounded-card border border-line bg-surface p-2 shadow-raised">
                <img 
                  src={heroImagem} 
                  alt="Três pessoas trabalhando juntas em um escritório" 
                  width={740}
                  height={493}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto rounded-card object-cover opacity-95"
                />
              </div>

              <div className="absolute -bottom-6 -right-6 hidden rounded-card border border-line bg-surface p-6 text-ink shadow-raised animate-float-slow md:block">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-control border border-success-line bg-success-soft text-success">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-ink-muted">Folha de pagamento</p>
                    <p className="text-lg font-bold text-ink">INSS calculado</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-12 order-1 lg:order-2">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:max-w-md lg:text-5xl">
                Anatomia da <br />
                <span className="text-brand">
                  Eficiência.
                </span>
              </h2>
              <p className="max-w-lg text-lg leading-relaxed text-ink-muted">
                Veja como o HRFlow organiza a rotina de RH: da estrutura da empresa ao holerite de cada colaborador.
              </p>
            </div>

            <div className="space-y-8 border-t border-line pt-10">
              <h3 className="text-2xl font-bold text-ink">O que o sistema faz hoje.</h3>
              
              <div className="grid grid-cols-1 gap-4">
                {[
                  { 
                    icon: <Cog size={20} />, 
                    title: "Estrutura da empresa", 
                    desc: "Cadastre departamentos e cargos e vincule os colaboradores.",
                    colorClasses: "text-brand bg-brand-soft border-brand-line group-hover:bg-brand-fill group-hover:text-brand-foreground"
                  },
                  { 
                    icon: <Network size={20} />, 
                    title: "Folha e holerites", 
                    desc: "Processe a folha dos colaboradores ativos e consulte cada holerite.",
                    colorClasses: "text-brand bg-brand-soft border-brand-line group-hover:bg-brand-fill group-hover:text-brand-foreground"
                  },
                  { 
                    icon: <Database size={20} />, 
                    title: "Acesso controlado", 
                    desc: "Perfis de Administrador, RH e Colaborador; senhas guardadas com hash.",
                    colorClasses: "text-success bg-success-soft border-success-line group-hover:bg-success group-hover:text-ink-inverse"
                  }
                ].map((item, index) => (
                  <div key={index} className="group flex items-start gap-5 rounded-card border border-line bg-surface p-6 shadow-card transition-shadow hover:shadow-raised">
                    <div className={`p-3 rounded-control transition-all duration-300 border ${item.colorClasses}`}>
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="mb-1 font-bold text-ink">{item.title}</h4>
                      <p className="text-sm text-ink-muted font-medium">{item.desc}</p>
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