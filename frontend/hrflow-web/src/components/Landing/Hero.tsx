import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative pt-40 pb-32 overflow-hidden bg-slate-900">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-orange-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[600px] h-[400px] bg-rose-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
        
        <div className="inline-flex items-center gap-2 bg-slate-800/50 border border-slate-700 px-4 py-2 rounded-full text-slate-300 text-xs font-black tracking-widest uppercase mb-8 shadow-sm backdrop-blur-sm">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          A Plataforma Definitiva de RH
        </div>

        <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-[0.95] mb-8">
          A folha de pagamento <br className="hidden md:block" />
          que se <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">calcula sozinha.</span>
        </h1>

        <p className="max-w-2xl mx-auto text-xl text-slate-400 font-medium leading-relaxed mb-12">
          Deixe nossa IA cuidar da burocracia, férias e descontos. Tenha controle total da sua empresa em uma interface incrivelmente rápida e bonita.
        </p>

        <div className="flex justify-center mb-24">
          <button onClick={() => navigate('/#contato')} className="group flex items-center gap-3 bg-white hover:bg-orange-500 text-slate-900 hover:text-white px-8 py-5 rounded-2xl font-black text-lg transition-all shadow-[0_0_40px_rgba(249,115,22,0.3)] active:scale-95">
            Ver o Sistema em Ação <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </section>
  );
}