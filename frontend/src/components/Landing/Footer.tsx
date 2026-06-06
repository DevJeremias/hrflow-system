import React from 'react';
import { Command } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-950 pt-24 pb-12 text-white">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-24">
          
          {/* Coluna da Marca */}
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg">
                <Command size={24} />
              </div>
              <span className="text-2xl font-black tracking-tighter">HR<span className="text-indigo-500">Flow</span></span>
            </div>
            <p className="text-xl text-slate-400 font-medium max-w-sm">
              Transformando a gestão de pessoas em uma vantagem competitiva ímpar para empresas do futuro.
            </p>
            <p className="text-sm font-bold text-slate-500 pt-4 border-t border-white/10 w-max">
              Projeto Acadêmico - Ciência da Computação
            </p>
          </div>

          {/* Coluna da Equipa */}
          <div className="space-y-8 md:pl-20">
            <h4 className="text-xs font-black text-indigo-500 uppercase tracking-[0.2em]">Equipe de Engenharia</h4>
            <ul className="space-y-4 text-lg font-bold text-slate-400">
              <li>Henrique Jeremias</li>
              <li>Marcos</li>
              <li>Yuri Afonso</li>
              <li>Caique Pinto</li>
              <li>Breno</li>
              <li>Thalison</li>
              <li>Henri Deluca</li>
            </ul>
          </div>

        </div>

        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-500 font-bold text-sm">
          <p>© {new Date().getFullYear()} HRFlow. Todos os direitos reservados.</p>
        </div>

      </div>
    </footer>
  );
}