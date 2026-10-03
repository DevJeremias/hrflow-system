import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

// O único <h1> da página. Os títulos de seção abaixo dele são h2.
const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions, className = '' }) => (
  <header className={`flex flex-col justify-between gap-4 md:flex-row md:items-center ${className}`}>
    <div className="min-w-0">
      <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">{title}</h1>
      {description && <p className="mt-1 text-ink-muted">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
  </header>
);

export default PageHeader;
