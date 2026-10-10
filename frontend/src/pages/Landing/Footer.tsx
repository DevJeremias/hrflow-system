import { Link } from 'react-router-dom';
import { Command, Github } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-surface-inverse pb-12 pt-16 text-ink-inverse sm:pt-20">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Ajustado para 4 colunas em telas grandes para acomodar o melhor das duas branches */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-24">
          
          {/* Coluna da Marca (Identidade da devi + Redes Sociais da main) */}
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center gap-3">
              <div className="bg-brand-fill p-2.5 rounded-control text-brand-foreground shadow-raised">
                <Command size={24} />
              </div>
              <span className="text-2xl font-bold tracking-tight">HR<span className="text-brand-fill">Flow</span></span>
            </div>
            
            <p className="max-w-sm text-base font-medium text-ink-inverse/70">
              Transformando a gestão de pessoas em uma vantagem competitiva ímpar para empresas do futuro.
            </p>
            
            <p className="w-max border-t border-ink-inverse/10 pt-4 text-sm font-semibold text-ink-inverse/70">
              Projeto Acadêmico - Ciência da Computação
            </p>

            <div className="flex gap-5 pt-2">
              <a
                href="https://github.com/DevJeremias/hrflow-system"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Código-fonte do HRFlow no GitHub"
                className="flex h-12 w-12 items-center justify-center rounded-card bg-ink-inverse/5 text-ink-inverse/70 transition-colors hover:bg-brand-fill hover:text-brand-foreground"
              >
                <Github size={20} />
              </a>
            </div>
          </div>

          {/* Coluna da Equipa (Da branch devi) */}
          <div className="space-y-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-fill">Equipe de Engenharia</h2>
            <ul className="space-y-4 text-sm font-semibold text-ink-inverse/70">
              <li>Henrique Jeremias</li>
              <li>Marcos</li>
              <li>Yuri Afonso</li>
              <li>Caique Pinto</li>
              <li>Breno</li>
              <li>Thalison</li>
              <li>Henri Deluca</li>
            </ul>
          </div>

          {/* Coluna de Produto (Da branch main, padronizada com a cor indigo) */}
          <div className="space-y-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-fill">Produto</h2>
            <ul className="space-y-4 text-sm font-semibold text-ink-inverse/70">
              <li><Link to="/#funcionalidades" className="transition-colors hover:text-ink-inverse">Funcionalidades</Link></li>
              <li><Link to="/#beneficios" className="transition-colors hover:text-ink-inverse">Benefícios</Link></li>
              <li><Link to="/#contato" className="transition-colors hover:text-ink-inverse">Criar conta</Link></li>
            </ul>
          </div>

        </div>

        {/* Rodapé (Combinando o copyright da devi com as políticas da main) */}
        <div className="flex flex-col items-center justify-between gap-6 border-t border-ink-inverse/10 pt-12 text-sm font-semibold text-ink-inverse/70 md:flex-row">
          <p>© {new Date().getFullYear()} HRFlow. Todos os direitos reservados.</p>
          <div className="flex gap-8">
            <Link to="/termos" className="transition-colors hover:text-ink-inverse">Termos de Uso</Link>
            <Link to="/privacidade" className="transition-colors hover:text-ink-inverse">Privacidade</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}