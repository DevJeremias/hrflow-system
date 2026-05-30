import React from 'react';
import { Layers, MousePointer2, ShieldCheck } from 'lucide-react';

export default function CommandCenter() {
  return (
    <section className="py-32 bg-slate-900 relative overflow-hidden">
      {/* Luzes de fundo */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/20 blur-[150px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/10 blur-[100px] rounded-full" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-24">
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-8">
            O Centro de Comando do seu Capital Humano
          </h2>
          <p className="text-xl text-slate-400 font-medium">
            Uma visão holística que conecta recrutamento, folha, benefícios e performance em uma única linha do tempo inteligente.
          </p>
        </div>

        <div className="relative h-[500px] md:h-[600px] flex items-center justify-center">
          
          <div className="absolute w-full max-w-4xl aspect-video bg-white/5 border border-white/10 rounded-[3rem] backdrop-blur-sm transform -rotate-x-12 translate-y-12 opacity-40"></div>
          
          <div className="absolute w-full max-w-3xl aspect-video bg-white/10 border border-white/20 rounded-[2.5rem] backdrop-blur-md transform -rotate-x-6 translate-y-6 opacity-70"></div>
          
          <div className="absolute w-full max-w-2xl bg-white p-10 md:p-16 rounded-[3rem] shadow-2xl shadow-indigo-900/50 transform group hover:scale-105 transition-transform duration-700">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
                <Layers size={32} />
              </div>
              <div>
                <h4 className="text-2xl font-black text-slate-900">Multicamadas</h4>
                <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Tecnologia de Ponta</p>
              </div>
            </div>
            <p className="text-xl text-slate-600 font-medium leading-relaxed mb-8">
              Nossa interface foi construída para que você nunca se sinta perdido. Navegue entre o macro e o micro com a fluidez de um toque.
            </p>
            <div className="flex flex-wrap gap-4">
              <span className="px-4 py-2 bg-slate-100 rounded-full text-sm font-black text-slate-600">IA Preditiva</span>
              <span className="px-4 py-2 bg-slate-100 rounded-full text-sm font-black text-slate-600">Cloud Sync</span>
              <span className="px-4 py-2 bg-slate-100 rounded-full text-sm font-black text-slate-600">LGPD Compliance</span>
            </div>
          </div>

          <div className="absolute top-10 right-20 animate-bounce-slow text-indigo-400 hidden lg:block"><MousePointer2 size={48} /></div>
          <div className="absolute bottom-10 left-20 animate-pulse text-emerald-400 hidden lg:block"><ShieldCheck size={56} /></div>
        </div>
      </div>
    </section>
  );
}