// src/components/Landing/Footer.tsx
import React from 'react';
import { Command, Instagram, Linkedin, Twitter, Github } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-950 pt-24 pb-12 text-white">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-16 mb-24">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg">
                <Command size={24} />
              </div>
              <span className="text-2xl font-black tracking-tighter">RH<span className="text-indigo-500">PRO</span></span>
            </div>
            <p className="text-xl text-slate-400 font-medium max-w-sm">
              Transformando a gestão de pessoas em uma vantagem competitiva imparável para empresas do futuro.
            </p>
            <div className="flex gap-5">
              {[Instagram, Linkedin, Twitter, Github].map((Icon, i) => (
                <a key={i} href="#" className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all text-slate-400">
                  <Icon size={20} />
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <h4 className="text-xs font-black text-indigo-500 uppercase tracking-[0.2em]">Produto</h4>
            <ul className="space-y-4 text-lg font-bold text-slate-400">
              <li><a href="#" className="hover:text-white transition-colors">Funcionalidades</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Segurança</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Preços</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Roadmap</a></li>
            </ul>
          </div>

          <div className="space-y-8">
            <h4 className="text-xs font-black text-indigo-500 uppercase tracking-[0.2em]">Newsletter</h4>
            <p className="text-slate-400 font-medium">Receba insights semanais sobre o futuro do trabalho.</p>
            <div className="relative group">
              <input 
                type="email" 
                placeholder="Seu melhor e-mail" 
                className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white/10 transition-all font-bold"
              />
              <button className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 px-6 rounded-xl font-black text-sm transition-all active:scale-95">
                OK
              </button>
            </div>
          </div>

        </div>

        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-500 font-bold text-sm">
          <p>© {new Date().getFullYear()} RHPRO. Todos os direitos reservados.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-white transition-colors">Privacidade</a>
            <a href="#" className="hover:text-white transition-colors">LGPD</a>
          </div>
        </div>

      </div>
    </footer>
  );
}