export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export const VARIANTES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-sunken',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger-hover',
  link: 'h-auto p-0 text-brand underline underline-offset-4 hover:text-brand-hover',
};

const TAMANHOS: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const BASE = 'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

export const classesDoBotao = (variant: ButtonVariant, size: ButtonSize, fullWidth = false) =>
  `${BASE} ${VARIANTES[variant]} ${variant === 'link' ? '' : TAMANHOS[size]} ${fullWidth ? 'w-full' : ''}`;

export const TAMANHOS_ICONE = { sm: 'h-9 w-9', md: 'h-11 w-11' } as const;
