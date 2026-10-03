import React from 'react';
import Spinner from './Spinner';
import { BASE, TAMANHOS_ICONE, VARIANTES, classesDoBotao, type ButtonSize, type ButtonVariant } from './buttonStyles';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  // Enquanto envia: desabilita, avisa o leitor de tela e troca o ícone pelo giro. O texto é de quem chama.
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

// `type` começa em "button": um botão dentro de <form> só envia quando pede type="submit".
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, icon, fullWidth, type = 'button', disabled, className = '', children, ...resto }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${classesDoBotao(variant, size, fullWidth)} ${className}`}
      {...resto}
    >
      {loading ? <Spinner size="sm" decorativo /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  // Todo botão só com ícone precisa de nome: aparece como dica e é o que o leitor de tela lê.
  label: string;
  variant?: Extract<ButtonVariant, 'secondary' | 'ghost' | 'danger'>;
  size?: 'sm' | 'md';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = 'ghost', size = 'md', type = 'button', className = '', children, ...resto }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`${BASE} ${VARIANTES[variant]} ${TAMANHOS_ICONE[size]} shrink-0 ${className}`}
      {...resto}
    >
      {children}
    </button>
  ),
);
IconButton.displayName = 'IconButton';

export default Button;
