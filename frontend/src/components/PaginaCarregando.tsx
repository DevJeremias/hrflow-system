import React from 'react';
import Spinner from './ui/Spinner';

// Fallback de Suspense: o código da tela ainda está chegando.
const PaginaCarregando: React.FC = () => (
  <div role="status" className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-brand">
    <Spinner size="lg" decorativo />
    <p className="font-semibold text-ink-muted">Carregando...</p>
  </div>
);

export default PaginaCarregando;
