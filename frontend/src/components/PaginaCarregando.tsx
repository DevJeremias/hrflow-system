import React from 'react';

// Fallback de Suspense: o código da tela ainda está chegando.
const PaginaCarregando: React.FC = () => (
  <div role="status" aria-label="Carregando" className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-slate-400">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
    <p className="font-bold">Carregando...</p>
  </div>
);

export default PaginaCarregando;
