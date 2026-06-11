import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Leaf } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 w-full z-50 bg-white transition-all duration-300 ${
        isScrolled ? 'py-3 shadow-md' : 'py-6 shadow-sm'
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => { window.scrollTo(0, 0); navigate('/'); }}
        >
          <img 
            src="./src/assets/logo.png" 
            alt="Logo da Empresa" 
            className="h-10 md:h-12 w-auto object-contain transition-transform group-hover:scale-105" 
          />
          
          <span className="text-2xl font-black text-gray-900 tracking-tight hidden sm:block">
            HR<span className="text-purple-500">flow</span>
          </span>
        </div>

        <nav className="hidden lg:flex items-center gap-8">
          {['soluções', 'sobre nós', 'programas', 'conteúdo'].map((item, i) => (
            <button 
              key={i} 
              className="flex items-center gap-1 text-gray-600 hover:text-green-600 font-bold text-sm transition-colors"
            >
              {item} <ChevronDown size={14} className="mt-0.5" />
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4 md:gap-6">
          <button 
            onClick={() => navigate('/login')} 
            className="hidden md:block text-sm font-bold text-gray-500 hover:text-green-600 transition-colors"
          >
            Fazer Login
          </button>
          
          <button 
            onClick={() => navigate('/#contato')} 
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-6 py-3 rounded-full transition-all shadow-lg hover:shadow-orange-500/30 active:scale-95"
          >
            Solicitar Demonstração
          </button>
        </div>

      </div>
    </header>
  );
}