import { Calculator, Users, ShieldCheck, Printer } from 'lucide-react';

export default function Features() {
  return (
    <section className="py-16 bg-white" id="funcionalidades">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="max-w-2xl mb-20">
          <h2 className="text-4xl md:text-5xl font-black text-ink tracking-tight mb-6">
            Do cadastro<br />
            <span className="text-brand">
              ao holerite.
            </span>
          </h2>
          <p className="text-xl text-ink-muted font-medium">
            O HRFlow reúne as rotinas básicas do Departamento Pessoal em uma só aplicação web: estrutura da empresa, colaboradores, ponto e folha.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="group md:col-span-2 flex flex-col items-center gap-8 rounded-card border border-line bg-surface-muted p-6 transition-shadow hover:shadow-raised md:flex-row sm:p-8">
            <div className="flex-1">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-card border border-brand-line bg-brand-soft text-brand shadow-card transition-colors group-hover:bg-brand-fill group-hover:text-brand-foreground">
                <Calculator size={28} />
              </div>
              <h3 className="text-2xl font-black text-ink mb-4">Folha de pagamento em lote</h3>
              <p className="text-ink-muted font-medium">
                Processe a folha de todos os colaboradores ativos de uma vez. O desconto de INSS é calculado no servidor e cada colaborador tem o seu holerite.
              </p>
            </div>
            
            <div className="w-full rounded-card border border-line bg-surface p-4 shadow-card md:w-64">
              <div className="mb-3 h-4 w-1/2 rounded-full bg-surface-muted"></div>
              <div className="mb-6 h-4 w-3/4 rounded-full bg-surface-muted"></div>
              <div className="flex h-10 w-full items-center rounded-control border border-success-line bg-success-soft px-4">
                <span className="text-sm font-semibold text-success">Desconto INSS</span>
              </div>
            </div>
          </div>

          <div className="group flex flex-col justify-between rounded-card border border-line bg-surface-muted p-6 transition-shadow hover:shadow-raised sm:p-8">
            <div>
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-card border border-brand-line bg-brand-soft text-brand shadow-card transition-colors group-hover:bg-brand-fill group-hover:text-brand-foreground">
                <Users size={28} />
              </div>
              <h3 className="text-2xl font-black text-ink mb-4">Estrutura Viva</h3>
              <p className="text-ink-muted font-medium">
                Cadastre departamentos e cargos, com gestor responsável, nível hierárquico e salário base, e vincule cada colaborador à sua posição.
              </p>
            </div>
          </div>

          <div className="group rounded-card border border-line bg-surface-muted p-6 transition-shadow hover:shadow-raised sm:p-8">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-card border border-success-line bg-success-soft text-success shadow-card transition-colors group-hover:bg-success group-hover:text-ink-inverse">
              <Printer size={24} />
            </div>
            <h3 className="text-xl font-black text-ink mb-2">Holerite para imprimir</h3>
            <p className="text-ink-muted text-sm font-medium">Abra o holerite de cada colaborador e imprima ou salve em PDF pelo navegador.</p>
          </div>

          <div className="group md:col-span-2 flex items-center gap-6 rounded-card border border-line bg-surface-muted p-6 transition-shadow hover:shadow-raised sm:p-8">
            <div className="hidden h-24 w-24 shrink-0 items-center justify-center rounded-full border border-brand-line bg-brand-soft text-brand shadow-card transition-transform group-hover:scale-105 md:flex">
              <ShieldCheck size={40} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink mb-2">Acesso por perfil</h3>
              <p className="text-ink-muted font-medium">O colaborador só enxerga os próprios dados; Administrador e RH gerem a empresa. A sessão fica em cookie protegido e as senhas são guardadas com hash.</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}