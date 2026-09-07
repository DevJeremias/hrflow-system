import React from 'react';
import { Layers, MousePointer2, ShieldCheck } from 'lucide-react';

export default function CommandCenter() {
  return (
    <section className="py-32 bg-slate-100 relative overflow-hidden">
      
      <div className="absolute top-40 right-0 w-[600px] h-[600px] bg-orange-300/30 blur-[120px] rounded-full mix-blend-multiply" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-400/30 blur-[100px] rounded-full mix-blend-multiply" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-24">
          <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter mb-8">
            O Centro de Comando do seu Capital Humano
          </h2>
          <p className="text-xl text-slate-600 font-medium">
            Uma visão holística que conecta recrutamento, folha, benefícios e performance em uma única linha do tempo inteligente.
          </p>
        </div>

        <div className="relative h-[500px] md:h-[600px] flex items-center justify-center">
          
          <div className="absolute w-full max-w-4xl aspect-video bg-slate-300/50 border border-slate-300 rounded-[3rem] backdrop-blur-sm transform -rotate-x-12 translate-y-12 opacity-70"></div>
          
          <div className="absolute w-full max-w-3xl aspect-video bg-slate-200 border border-slate-300 rounded-[2.5rem] backdrop-blur-md transform -rotate-x-6 translate-y-6 opacity-90"></div>
          
          <div className="absolute w-full max-w-2xl bg-white p-10 md:p-16 rounded-[3rem] shadow-2xl shadow-slate-300/60 transform group hover:scale-105 transition-transform duration-700 border border-slate-200">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 border border-orange-200">
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
              <span className="px-4 py-2 bg-orange-50 border border-orange-200 rounded-full text-sm font-black text-orange-600">IA Preditiva</span>
              <span className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-full text-sm font-black text-purple-600">Cloud Sync</span>
              <span className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-sm font-black text-emerald-600">LGPD Compliance</span>
            </div>
          </div>

          <div className="absolute top-10 right-20 animate-bounce-slow text-purple-500 hidden lg:block"><MousePointer2 size={48} /></div>
          <div className="absolute bottom-10 left-20 animate-pulse text-emerald-500 hidden lg:block"><ShieldCheck size={56} /></div>
        </div>
        
      </div>
    </section>
  );
}