import React from 'react';
import { Download } from 'lucide-react';
import { enderecoDaExportacao, type Relatorio } from '../../services/relatoriosService';
import { classesDoBotao } from '../ui/buttonStyles';

interface Props {
  relatorio: Relatorio;
  query: URLSearchParams;
}

// CSV e PDF do relatório que está na tela, com os mesmos filtros. É um link comum: o cookie da sessão
// segue sozinho e o navegador baixa o arquivo com o nome que a API sugere.
const ExportarRelatorio: React.FC<Props> = ({ relatorio, query }) => (
  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Exportar o relatório">
    {(['csv', 'pdf'] as const).map((formato) => (
      <a key={formato} href={enderecoDaExportacao(relatorio, query, formato)} download className={classesDoBotao('secondary', 'sm')}>
        <Download size={16} aria-hidden="true" />
        Exportar {formato.toUpperCase()}
      </a>
    ))}
  </div>
);

export default ExportarRelatorio;
