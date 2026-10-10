import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Command, Menu, X } from 'lucide-react';

const SECOES = [
  { rotulo: 'Funcionalidades', destino: '/#funcionalidades' },
  { rotulo: 'Benefícios', destino: '/#beneficios' },
  { rotulo: 'Como é por dentro', destino: '/#evidencia' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fecharMenu = () => setMenuAberto(false);

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 backdrop-blur-md transition-all duration-300 ${
        menuAberto ? 'bg-surface' : 'bg-surface/80'
      } ${isScrolled || menuAberto ? 'py-3 shadow-card' : 'py-6 shadow-card'}`}
    >
      <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between">

        {/* Logo e Marca */}
        <Link
          to="/"
          aria-label="HRFlow, página inicial"
          className="flex items-center gap-3 group"
          onClick={() => window.scrollTo(0, 0)}
        >
          <span aria-hidden="true" className="bg-surface-inverse p-2 rounded-control text-white group-hover:bg-brand-fill transition-colors duration-500 shadow-card">
            <Command size={20} />
          </span>
          <span aria-hidden="true" className="text-2xl font-black text-ink tracking-tight">
            HR<span className="text-brand">Flow</span>
          </span>
        </Link>

        {/* Navegação Central */}
        <nav aria-label="Seções da página" className="hidden lg:flex items-center gap-8">
          {SECOES.map(({ rotulo, destino }) => (
            <Link
              key={destino}
              to={destino}
              className="text-ink-muted hover:text-brand font-bold text-sm transition-colors"
            >
              {rotulo}
            </Link>
          ))}
        </nav>

        {/* Ações */}
        <div className="flex items-center gap-4 md:gap-6">
          <Link
            to="/login"
            className="hidden md:block text-sm font-bold text-ink-muted hover:text-brand transition-colors"
          >
            Entrar
          </Link>

          <Link
            to="/#contato"
            className="hidden md:block bg-brand-fill hover:bg-brand-fill-hover text-brand-foreground text-sm font-bold px-6 py-3 rounded-control transition-all shadow-raised active:scale-95"
          >
            Criar conta
          </Link>

          <button
            type="button"
            onClick={() => setMenuAberto((aberto) => !aberto)}
            aria-expanded={menuAberto}
            aria-controls="menu-mobile"
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            className="md:hidden flex h-11 w-11 items-center justify-center -mr-2 text-ink rounded-control hover:bg-surface-sunken transition-colors"
          >
            {menuAberto ? <X size={26} aria-hidden="true" /> : <Menu size={26} aria-hidden="true" />}
          </button>
        </div>

      </div>

      {menuAberto && (
        <nav id="menu-mobile" aria-label="Menu" className="md:hidden max-w-[1440px] mx-auto px-6 pt-4 pb-2 flex flex-col gap-1">
          {SECOES.map(({ rotulo, destino }) => (
            <Link
              key={destino}
              to={destino}
              onClick={fecharMenu}
              className="py-3 text-ink hover:text-brand font-bold border-b border-line"
            >
              {rotulo}
            </Link>
          ))}
          <Link
            to="/login"
            onClick={fecharMenu}
            className="mt-3 py-3 text-center font-bold text-ink border border-line-input rounded-control"
          >
            Entrar
          </Link>
          <Link
            to="/#contato"
            onClick={fecharMenu}
            className="mt-2 py-3 text-center font-bold text-brand-foreground bg-brand-fill rounded-control"
          >
            Criar conta
          </Link>
        </nav>
      )}
    </header>
  );
}
