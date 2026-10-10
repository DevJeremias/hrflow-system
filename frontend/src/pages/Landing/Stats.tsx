
export default function Stats() {
  const stats = [
    { value: "Folha", label: "Processada em lote", desc: "Desconto de INSS calculado pelo servidor" },
    { value: "Ponto", label: "Registrado pelo colaborador", desc: "Entrada, almoço e saída, com consulta pelo RH" },
    { value: "3 perfis", label: "Com acesso separado", desc: "Administrador, RH e Colaborador" },
  ];

  return (
    <section className="relative z-20 -mt-12 rounded-t-card bg-surface-inverse py-12 text-ink-inverse shadow-raised md:-mt-24 sm:py-16" id="metricas">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 divide-y md:divide-y-0 md:divide-x divide-ink-inverse/10">
          {stats.map((stat, index) => (
            <div key={index} className="flex flex-col items-center text-center pt-8 md:pt-0 px-6">
              <h3 className="mb-2 text-4xl font-bold tracking-tight text-ink-inverse sm:text-5xl">
                {stat.value}
              </h3>
              <p className="mb-1 font-semibold text-brand-fill">{stat.label}</p>
              <p className="text-sm font-medium text-ink-inverse/70">{stat.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}