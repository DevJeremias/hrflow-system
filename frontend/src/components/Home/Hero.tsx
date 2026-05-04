// src/components/Landing/Hero.tsx
import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative pt-40 pb-32 overflow-hidden bg-[#fafafa]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[600px] h-[400px] bg-rose-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
        
        <div className="inline-flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-full text-slate-600 text-xs font-black tracking-widest uppercase mb-8 shadow-sm">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          A Plataforma Definitiva de RH
        </div>

        <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter leading-[0.95] mb-8">
          A folha de pagamento <br className="hidden md:block" />
          que se <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-rose-500">calcula sozinha.</span>
        </h1>

        <p className="max-w-2xl mx-auto text-xl text-slate-500 font-medium leading-relaxed mb-12">
          Deixe nossa IA cuidar da burocracia, férias e descontos. Tenha controle total da sua empresa em uma interface incrivelmente rápida e bonita.
        </p>

        <div className="flex justify-center mb-24">
          <button onClick={() => navigate('/#contato')} className="group flex items-center gap-3 bg-slate-900 hover:bg-indigo-600 text-white px-8 py-5 rounded-2xl font-black text-lg transition-all shadow-2xl shadow-indigo-900/20 active:scale-95">
            Ver o Sistema em Ação <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </section>
  );
}