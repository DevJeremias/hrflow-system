import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <div className="fixed top-0 w-full z-50 flex justify-center pt-6 px-4 pointer-events-none">
      <nav className="pointer-events-auto w-full max-w-5xl bg-white/60 backdrop-blur-2xl border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl px-6 py-4 flex items-center justify-between transition-all duration-300">
        
        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo(0, 0)}>
          <div className="bg-slate-900 p-2.5 rounded-xl text-white group-hover:bg-indigo-600 transition-colors duration-500 shadow-md">
            <Command size={18} />
          </div>
          <span className="text-slate-900 font-black text-xl tracking-tight">
            Sistema<span className="text-indigo-600">RH</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/login')} className="hidden md:block text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
            Fazer Login
          </button>
          <button onClick={() => navigate('/#contato')} className="bg-slate-900 hover:bg-indigo-600 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all shadow-lg active:scale-95">
            Cadastrar Empresa
          </button>
        </div>
      </nav>
    </div>
  );
}