import React from 'react';

const TAMANHOS = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-24 w-24 text-3xl' } as const;

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof TAMANHOS;
  // Vazio por padrão: o nome costuma estar escrito ao lado. Passe um texto quando o avatar estiver sozinho.
  alt?: string;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md', alt = '', className = '' }) => (
  <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft font-bold uppercase text-brand ${TAMANHOS[size]} ${className}`}>
    {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : <span aria-hidden="true">{name.trim().charAt(0) || '?'}</span>}
  </span>
);

export default Avatar;
