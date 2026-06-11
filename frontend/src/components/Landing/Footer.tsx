import React from 'react';
import { Command, Instagram, Linkedin, Twitter, Github } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-zinc-950 pt-24 pb-12 text-white">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Ajustado para 4 colunas em telas grandes para acomodar o melhor das duas branches */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-24">
          
          {/* Coluna da Marca (Identidade da devi + Redes Sociais da main) */}
          <div className="lg:col-span-2 space-y-8">
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

            <div className="flex gap-5 pt-2">
              {[Instagram, Linkedin, Twitter, Github].map((Icon, i) => (
                <a key={i} href="#" className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all text-slate-400">
                  <Icon size={20} />
                </a>
              ))}
            </div>
          </div>

          {/* Coluna da Equipa (Da branch devi) */}
          <div className="space-y-8">
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

          {/* Coluna de Produto (Da branch main, padronizada com a cor indigo) */}
          <div className="space-y-8">
            <h4 className="text-xs font-black text-indigo-500 uppercase tracking-[0.2em]">Produto</h4>
            <ul className="space-y-4 text-lg font-bold text-slate-400">
              <li><a href="#" className="hover:text-white transition-colors">Funcionalidades</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Segurança</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Roadmap</a></li>
            </ul>
          </div>

        </div>

        {/* Rodapé (Combinando o copyright da devi com as políticas da main) */}
        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-500 font-bold text-sm">
          <p>© {new Date().getFullYear()} HRFlow. Todos os direitos reservados.</p>
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