import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './ui/Button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  // Troca de valor limpa o erro: o Layout passa o caminho, e navegar para outra tela tenta de novo.
  resetKey?: unknown;
  // Fallback de tela inteira, para o limite que fica acima do menu e do roteador.
  fullScreen?: boolean;
}

interface ErrorBoundaryState {
  failed: boolean;
}

// Uma falha ao desenhar (resposta fora do contrato, bug de componente) fica contida aqui em vez de
// desmontar a árvore inteira e deixar a tela branca.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Falha ao exibir a tela:', error, info.componentStack);
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className={this.props.fullScreen ? 'flex min-h-screen items-center justify-center bg-surface-muted p-6' : 'flex justify-center py-12'}>
        <div role="alert" className="w-full max-w-md space-y-4 rounded-card border border-danger-line bg-danger-soft p-6 text-center">
          <AlertTriangle size={32} aria-hidden="true" className="mx-auto text-danger" />
          <h2 className="text-lg font-bold text-ink">Algo deu errado</h2>
          <p className="text-sm text-ink-muted">
            Não foi possível exibir esta tela. Recarregue a página para tentar de novo.
          </p>
          <Button variant="danger" onClick={() => window.location.reload()}>Recarregar a página</Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
