import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Command } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-md transition-all duration-300 ${
        isScrolled ? 'py-3 shadow-md' : 'py-6 shadow-sm'
      }`}
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
        <nav className="hidden lg:flex items-center gap-8">
          {['soluções', 'sobre nós', 'programas', 'conteúdo'].map((item, i) => (
            <button 
              key={i} 
              className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-bold text-sm transition-colors"
            >
              {item} <ChevronDown size={14} className="mt-0.5" />
            </button>
          ))}
        </nav>

        {/* Ações */}
        <div className="flex items-center gap-4 md:gap-6">
          <button 
            onClick={() => navigate('/login')} 
            className="hidden md:block text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors"
          >
            Fazer Login
          </button>
          
          <button 
            onClick={() => navigate('/#contato')} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-6 py-3 rounded-full transition-all shadow-lg hover:shadow-indigo-500/30 active:scale-95"
          >
            Solicitar Demonstração
          </button>
        </div>

      </div>
    </header>
  );
}