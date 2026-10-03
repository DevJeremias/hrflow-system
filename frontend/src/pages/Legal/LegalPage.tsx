import React, { useEffect } from 'react';
import { usePageTitle } from '../../hooks/usePageTitle';
import Navbar from '../Landing/Navbar';
import Footer from '../Landing/Footer';

interface LegalPageProps {
  titulo: string;
  atualizadoEm: string;
  children: React.ReactNode;
}

export const Secao = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{titulo}</h2>
    {children}
  </section>
);

export default function LegalPage({ titulo, atualizadoEm, children }: LegalPageProps) {
  usePageTitle(titulo);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [titulo]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-36 pb-24 space-y-10 text-lg font-medium leading-relaxed text-slate-600 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2">
        <header className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">{titulo}</h1>
          <p className="text-sm font-bold text-ink-muted">Última atualização: {atualizadoEm}</p>
          <p className="text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            Versão inicial deste texto, ainda sujeita a revisão pelo responsável pelo produto.
          </p>
        </header>
        {children}
      </main>
      <Footer />
    </div>
  );
}
