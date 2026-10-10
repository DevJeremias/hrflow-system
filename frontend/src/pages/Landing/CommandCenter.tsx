import { Layers, MousePointer2, ShieldCheck } from 'lucide-react';

export default function CommandCenter() {
  return (
    <section className="relative overflow-hidden bg-surface-muted py-20 sm:py-24">
      
      <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-brand-soft opacity-50 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-brand-soft opacity-40 blur-3xl" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-24">
          <h2 className="mb-8 text-3xl font-bold tracking-tight text-ink sm:text-4xl lg:text-5xl">
            Um só lugar para a rotina de RH
          </h2>
          <p className="text-lg font-medium text-ink-muted">
            Estrutura da empresa, colaboradores, ponto e folha de pagamento na mesma aplicação, com um portal para cada colaborador.
          </p>
        </div>

        <div className="relative h-[500px] md:h-[600px] flex items-center justify-center">
          
          <div className="absolute aspect-video w-full max-w-4xl translate-y-12 rounded-card border border-line bg-surface-muted opacity-70"></div>
          
          <div className="absolute aspect-video w-full max-w-3xl translate-y-6 rounded-card border border-line bg-surface opacity-90"></div>
          
          <div className="group absolute w-full max-w-2xl rounded-card border border-line bg-surface p-6 shadow-raised transition-transform duration-700 hover:scale-105 md:p-12">
            <div className="flex items-center gap-6 mb-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-card border border-brand-line bg-brand-soft text-brand">
                <Layers size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-ink">Do RH ao colaborador</h3>
                <p className="text-ink-muted font-bold uppercase text-xs tracking-widest">Dois lados, um sistema</p>
              </div>
            </div>
            <p className="text-xl text-ink-muted font-medium leading-relaxed mb-8">
              O RH cadastra, aprova e processa a folha. O colaborador registra o ponto, consulta os holerites e envia solicitações, cada um na sua área.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <span className="rounded-full border border-brand-line bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">Folha</span>
              <span className="rounded-full border border-line bg-surface-muted px-4 py-2 text-sm font-semibold text-ink">Ponto</span>
              <span className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink">Portal do colaborador</span>
            </div>
          </div>

          <div className="absolute right-20 top-10 hidden text-brand lg:block"><MousePointer2 size={48} /></div>
          <div className="absolute bottom-10 left-20 hidden animate-pulse text-success lg:block"><ShieldCheck size={56} /></div>
        </div>
        
      </div>
    </section>
  );
}