import React from 'react';

const ESPACAMENTO = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' } as const;

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article';
  padding?: keyof typeof ESPACAMENTO;
}

const Card: React.FC<CardProps> = ({ as: Tag = 'div', padding = 'md', className = '', ...resto }) => (
  <Tag className={`rounded-card border border-line bg-surface shadow-card ${ESPACAMENTO[padding]} ${className}`} {...resto} />
);

interface CardHeaderProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  // A hierarquia da página decide o nível: h2 sob o h1 do PageHeader, h3 dentro de uma seção.
  level?: 2 | 3;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, icon, actions, level = 2, className = '' }) => {
  const Titulo = level === 2 ? 'h2' : 'h3';
  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface-muted px-5 py-4 sm:px-6 ${className}`}>
      <div className="flex items-center gap-3">
        {icon && <span aria-hidden="true" className="rounded-control bg-brand-soft p-2 text-brand">{icon}</span>}
        <Titulo className="text-lg font-bold tracking-tight text-ink">{title}</Titulo>
      </div>
      {actions}
    </div>
  );
};

export default Card;
