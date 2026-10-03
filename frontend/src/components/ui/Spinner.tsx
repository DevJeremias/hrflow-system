import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  // Dentro de um botão ou de um texto que já diz o que carrega, o giro é só enfeite.
  decorativo?: boolean;
  rotulo?: string;
  className?: string;
}

const TAMANHOS = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-10 w-10 border-4' } as const;

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', decorativo = false, rotulo = 'Carregando', className = '' }) => (
  <span
    {...(decorativo ? { 'aria-hidden': true } : { role: 'status' })}
    className={`inline-flex items-center justify-center ${className}`}
  >
    <span className={`${TAMANHOS[size]} animate-spin rounded-full border-current border-t-transparent opacity-80 motion-reduce:animate-none`} />
    {!decorativo && <span className="sr-only">{rotulo}</span>}
  </span>
);

export default Spinner;
