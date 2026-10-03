import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Command, Menu, X } from 'lucide-react';

const SECOES = [
  { rotulo: 'Funcionalidades', destino: '/#funcionalidades' },
  { rotulo: 'Benefícios', destino: '/#beneficios' },
  { rotulo: 'Como é por dentro', destino: '/#evidencia' },
];

export default function Navbar() {
  const navigate = useNavigate();
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
        menuAberto ? 'bg-white' : 'bg-white/80'
      } ${isScrolled || menuAberto ? 'py-3 shadow-md' : 'py-6 shadow-sm'}`}
    >
      <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between">

        {/* Logo e Marca */}
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => { window.scrollTo(0, 0); navigate('/'); }}
        >
          <div className="bg-slate-900 p-2 rounded-xl text-white group-hover:bg-indigo-600 transition-colors duration-500 shadow-md">
            <Command size={20} />
          </div>
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            HR<span className="text-indigo-600">Flow</span>
          </span>
        </div>

        {/* Navegação Central */}
        <nav aria-label="Seções da página" className="hidden lg:flex items-center gap-8">
          {SECOES.map(({ rotulo, destino }) => (
            <Link
              key={destino}
              to={destino}
              className="text-slate-600 hover:text-indigo-600 font-bold text-sm transition-colors"
            >
              {rotulo}
            </Link>
          ))}
        </nav>

        {/* Ações */}
        <div className="flex items-center gap-4 md:gap-6">
          <Link
            to="/login"
            className="hidden md:block text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors"
          >
            Entrar
          </Link>

          <Link
            to="/#contato"
            className="hidden md:block bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-6 py-3 rounded-full transition-all shadow-lg hover:shadow-indigo-500/30 active:scale-95"
          >
            Criar conta
          </Link>

          <button
            type="button"
            onClick={() => setMenuAberto((aberto) => !aberto)}
            aria-expanded={menuAberto}
            aria-controls="menu-mobile"
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            className="md:hidden p-2 -mr-2 text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
          >
            {menuAberto ? <X size={26} /> : <Menu size={26} />}
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
              className="py-3 text-slate-700 hover:text-indigo-600 font-bold border-b border-slate-100"
            >
              {rotulo}
            </Link>
          ))}
          <Link
            to="/login"
            onClick={fecharMenu}
            className="mt-3 py-3 text-center font-bold text-slate-900 border border-slate-300 rounded-full"
          >
            Entrar
          </Link>
          <Link
            to="/#contato"
            onClick={fecharMenu}
            className="mt-2 py-3 text-center font-bold text-white bg-indigo-600 rounded-full"
          >
            Criar conta
          </Link>
        </nav>
      )}
    </header>
  );
}
