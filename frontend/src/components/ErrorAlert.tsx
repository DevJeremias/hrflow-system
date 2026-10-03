import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

// Erro de carregamento visível na tela: nunca no lugar de um "lista vazia" que pareça verdadeiro.
const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onRetry }) => (
  <div role="alert" className="flex flex-wrap items-center justify-between gap-4 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100">
    <div className="flex items-center gap-2">
      <AlertCircle size={18} className="shrink-0" />
      <p>{message}</p>
    </div>
    {onRetry && (
      <button type="button" onClick={onRetry} className="underline underline-offset-4 hover:text-red-700 transition-colors">
        Tentar novamente
      </button>
    )}
  </div>
);

export default ErrorAlert;
