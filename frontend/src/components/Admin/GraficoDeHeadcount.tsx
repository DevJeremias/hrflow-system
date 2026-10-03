import React from 'react';
import type { HeadcountRow } from '../../services/relatoriosService';
import { rotuloCurtoDoMes, rotuloDaCompetencia } from '../../utils/competencia';

interface Props {
  linhas: readonly HeadcountRow[];
  // Nome do gráfico para o leitor de tela.
  titulo: string;
}

// Barras dos colaboradores ativos no fim de cada mês. São caixas HTML, não SVG: o texto continua com o
// tamanho certo no celular. O leitor de tela lê a tabela escondida, que traz os mesmos números.
const GraficoDeHeadcount: React.FC<Props> = ({ linhas, titulo }) => {
  const maximo = Math.max(1, ...linhas.map((linha) => linha.ativos));

  return (
    <figure aria-label={titulo} className="m-0">
      <div className="overflow-x-auto">
        <div aria-hidden="true" className="flex h-56 min-w-max items-end gap-2 border-b border-line px-1 pt-6 sm:min-w-0 sm:gap-3">
          {linhas.map((linha) => (
            <div key={linha.mes} className="flex h-full w-10 flex-1 flex-col justify-end sm:w-auto">
              <span className="mb-1 text-center text-xs font-semibold text-ink">{linha.ativos}</span>
              <div
                className="w-full rounded-t-control bg-brand"
                style={{ height: `${(linha.ativos / maximo) * 100}%`, minHeight: linha.ativos > 0 ? '4px' : '0' }}
              />
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="flex min-w-max gap-2 px-1 pt-2 sm:min-w-0 sm:gap-3">
          {linhas.map((linha) => (
            <span key={linha.mes} className="w-10 flex-1 text-center text-xs text-ink-muted sm:w-auto">{rotuloCurtoDoMes(linha.mes)}</span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{titulo}</caption>
        <thead><tr><th scope="col">Mês</th><th scope="col">Ativos</th><th scope="col">Admitidos</th><th scope="col">Desligados</th></tr></thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.mes}><th scope="row">{rotuloDaCompetencia(linha.mes)}</th><td>{linha.ativos}</td><td>{linha.admitidos}</td><td>{linha.desligados}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

export default GraficoDeHeadcount;
