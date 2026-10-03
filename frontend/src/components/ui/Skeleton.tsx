import React from 'react';

// Placeholder de carregamento. É mudo para o leitor de tela: quem o usa declara o estado com Spinner ou aria-busy.
const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
  <div aria-hidden="true" className={`animate-pulse rounded-control bg-surface-sunken motion-reduce:animate-none ${className}`} />
);

export default Skeleton;
