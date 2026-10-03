import React from 'react';
import { AlertTriangle } from 'lucide-react';

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
      <div className={this.props.fullScreen ? 'flex min-h-screen items-center justify-center p-6 bg-slate-50' : 'flex justify-center py-12'}>
        <div role="alert" className="w-full max-w-md space-y-4 rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
          <AlertTriangle size={32} className="mx-auto text-red-500" />
          <h2 className="text-lg font-black text-slate-900">Algo deu errado</h2>
          <p className="text-sm font-medium text-slate-600">
            Não foi possível exibir esta tela. Recarregue a página para tentar de novo.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors"
          >
            Recarregar a página
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
