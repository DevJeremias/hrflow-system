import React from 'react';
import ErrorAlert from '../ErrorAlert';
import Spinner from '../ui/Spinner';
import { mensagemDeErro } from '../../utils/erros';

interface Props {
  carregando: boolean;
  erro: unknown;
  mensagemDeErroPadrao: string;
  aoTentarDeNovo: () => void;
  // O que mostrar no lugar do erro quando ele tem uma explicação melhor (ex.: folha ainda não processada).
  explicarErro?: (erro: unknown) => React.ReactNode;
  children: React.ReactNode;
}

// O que todo relatório faz antes de mostrar a tabela: carregando, falhou ou pronto.
const CorpoDoRelatorio: React.FC<Props> = ({ carregando, erro, mensagemDeErroPadrao, aoTentarDeNovo, explicarErro, children }) => {
  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-muted">
        <Spinner size="lg" rotulo="Carregando o relatório" />
        <p className="font-semibold" aria-hidden="true">Carregando o relatório...</p>
      </div>
    );
  }
  if (erro) {
    const explicacao = explicarErro?.(erro);
    return <>{explicacao ?? <ErrorAlert message={mensagemDeErro(erro, mensagemDeErroPadrao)} onRetry={aoTentarDeNovo} />}</>;
  }
  return <>{children}</>;
};

export default CorpoDoRelatorio;
