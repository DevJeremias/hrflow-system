import React from 'react';
import logo from '../../assets/logo.png';

// A moldura das telas de acesso que não são o login: a marca, o cartão e o conteúdo da etapa.
const CartaoDeAcesso: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="flex min-h-screen w-full items-center justify-center bg-surface-muted px-4 py-10">
    <div className="w-full max-w-md rounded-modal border border-line bg-surface p-6 shadow-card sm:p-10">
      <div className="mb-8 flex items-center gap-3">
        <img src={logo} alt="" className="h-10 w-auto object-contain" />
        <span className="text-2xl font-bold tracking-tight text-ink">HRFlow</span>
      </div>
      {children}
    </div>
  </main>
);

export default CartaoDeAcesso;
