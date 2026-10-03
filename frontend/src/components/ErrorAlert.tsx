import React from 'react';
import { AlertCircle } from 'lucide-react';
import Button from './ui/Button';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

// Erro de carregamento visível na tela: nunca no lugar de um "lista vazia" que pareça verdadeiro.
const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onRetry }) => (
  <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-danger-line bg-danger-soft p-4 text-sm font-semibold text-danger">
    <div className="flex items-center gap-2">
      <AlertCircle size={18} aria-hidden="true" className="shrink-0" />
      <p>{message}</p>
    </div>
    {onRetry && (
      <Button variant="link" size="sm" onClick={onRetry} className="text-danger hover:text-danger-hover">
        Tentar novamente
      </Button>
    )}
  </div>
);

export default ErrorAlert;
