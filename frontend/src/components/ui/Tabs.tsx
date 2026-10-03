import React, { useRef } from 'react';
import { idDaAba, idDoPainel } from './tabsIds';

export interface TabItem<Id extends string> {
  id: Id;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps<Id extends string> {
  tabs: readonly TabItem<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  // Descreve o conjunto ao leitor de tela ("Seções do perfil").
  label: string;
  // Prefixo único dos ids que ligam cada aba ao seu painel (veja TabPanel).
  idPrefix: string;
  variant?: 'underline' | 'pill';
  className?: string;
}

const LISTA = { underline: 'flex gap-4 overflow-x-auto sm:gap-6 border-b border-line', pill: 'inline-flex max-w-full gap-1 overflow-x-auto rounded-card bg-surface-sunken p-1.5' } as const;
const ABA = {
  underline: (ativa: boolean) => `-mb-px flex shrink-0 items-center gap-1.5 border-b-4 py-3 sm:gap-2 sm:py-4 text-sm font-semibold ${ativa ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink'}`,
  pill: (ativa: boolean) => `flex shrink-0 items-center gap-1.5 rounded-control px-2.5 py-2.5 sm:gap-2 sm:px-5 text-sm font-semibold ${ativa ? 'bg-surface text-brand shadow-card' : 'text-ink-muted hover:text-ink'}`,
} as const;

// Padrão WAI-ARIA de abas: só a aba ativa entra na ordem de Tab; as setas, Home e End movem entre elas.
function Tabs<Id extends string>({ tabs, value, onChange, label, idPrefix, variant = 'underline', className = '' }: TabsProps<Id>) {
  const lista = useRef<HTMLDivElement>(null);

  const aoTeclar = (evento: React.KeyboardEvent<HTMLDivElement>) => {
    const atual = tabs.findIndex((aba) => aba.id === value);
    const destino = { ArrowRight: atual + 1, ArrowLeft: atual - 1, Home: 0, End: tabs.length - 1 }[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    const proxima = tabs[(destino + tabs.length) % tabs.length];
    onChange(proxima.id);
    document.getElementById(idDaAba(idPrefix, proxima.id))?.focus();
  };

  return (
    <div ref={lista} role="tablist" aria-label={label} onKeyDown={aoTeclar} className={`${LISTA[variant]} ${className}`}>
      {tabs.map((aba) => {
        const ativa = aba.id === value;
        return (
          <button
            key={aba.id}
            id={idDaAba(idPrefix, aba.id)}
            type="button"
            role="tab"
            aria-selected={ativa}
            aria-controls={idDoPainel(idPrefix, aba.id)}
            tabIndex={ativa ? 0 : -1}
            onClick={() => onChange(aba.id)}
            className={ABA[variant](ativa)}
          >
            {aba.icon && <span aria-hidden="true">{aba.icon}</span>}
            {aba.label}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  idPrefix: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}

export const TabPanel: React.FC<TabPanelProps> = ({ idPrefix, id, className = '', children }) => (
  <div role="tabpanel" id={idDoPainel(idPrefix, id)} aria-labelledby={idDaAba(idPrefix, id)} className={className}>{children}</div>
);

export default Tabs;
