import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center gap-4 px-6 py-16 text-center ${className}`}>
    {icon && <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">{icon}</span>}
    <div>
      <p className="text-lg font-bold text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
    </div>
    {action}
  </div>
);

export default EmptyState;
