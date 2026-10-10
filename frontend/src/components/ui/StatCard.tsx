import React from 'react';
import { Link } from 'react-router-dom';

export type StatTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'inverse';

const CARTAO: Record<StatTone, string> = {
  neutral: 'border-line bg-surface',
  brand: 'border-line bg-surface',
  success: 'border-line bg-surface',
  warning: 'border-warning-line bg-warning-soft',
  danger: 'border-danger-line bg-danger-soft',
  inverse: 'border-transparent bg-surface-inverse',
};

const ICONE: Record<StatTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warning: 'bg-surface text-warning',
  danger: 'bg-surface text-danger',
  inverse: 'bg-white/10 text-success',
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: StatTone;
  // Com destino, o cartão inteiro é um link.
  to?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, hint, icon, tone = 'neutral', to }) => {
  const escuro = tone === 'inverse';
  const classes = `flex h-full flex-col gap-4 rounded-card border p-5 shadow-card sm:p-6 ${CARTAO[tone]}`;
  const conteudo = (
    <>
      {icon && <span aria-hidden="true" className={`flex h-12 w-12 items-center justify-center rounded-control ${ICONE[tone]}`}>{icon}</span>}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
        <p className={`mt-1 text-2xl font-bold tracking-tight sm:text-3xl ${escuro ? 'text-ink-inverse' : 'text-ink'}`}>{value}</p>
        {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      </div>
    </>
  );
  if (to) return <Link to={to} data-escuro={escuro ? '' : undefined} className={`${classes} transition-shadow hover:shadow-raised`}>{conteudo}</Link>;
  return <div data-escuro={escuro ? '' : undefined} className={classes}>{conteudo}</div>;
};

export default StatCard;
