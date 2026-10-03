import React from 'react';
import Skeleton from './Skeleton';

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  // Célula do rodapé (totais). O rodapé só existe se alguma coluna o define.
  footer?: React.ReactNode;
  // Sem rótulo no modo cartão: a célula ocupa a linha toda (nome do item, botões de ação).
  semRotuloNoCartao?: boolean;
  className?: string;
}

// Abaixo do ponto de quebra cada linha vira um cartão com "rótulo: valor"; a partir dele é uma tabela.
// As classes são literais para o Tailwind enxergá-las.
const QUEBRA = {
  md: {
    rolagem: 'md:overflow-x-auto',
    tabela: 'md:table',
    cabecalho: 'md:table-header-group md:not-sr-only',
    corpo: 'md:table-row-group md:divide-y md:divide-line',
    rodape: 'md:table-footer-group',
    linha: 'md:table-row md:mb-0 md:rounded-none md:border-0 md:p-0 md:shadow-none',
    celula: 'md:table-cell md:px-6 md:py-4 md:before:hidden',
    celulaCompacta: 'md:table-cell md:px-2.5 md:py-3 md:before:hidden',
    alinhamento: { left: 'md:text-left', center: 'md:text-center', right: 'md:text-right' },
  },
  lg: {
    rolagem: 'lg:overflow-x-auto',
    tabela: 'lg:table',
    cabecalho: 'lg:table-header-group lg:not-sr-only',
    corpo: 'lg:table-row-group lg:divide-y lg:divide-line',
    rodape: 'lg:table-footer-group',
    linha: 'lg:table-row lg:mb-0 lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none',
    celula: 'lg:table-cell lg:px-6 lg:py-4 lg:before:hidden',
    celulaCompacta: 'lg:table-cell lg:px-2.5 lg:py-3 lg:before:hidden',
    alinhamento: { left: 'lg:text-left', center: 'lg:text-center', right: 'lg:text-right' },
  },
  xl: {
    rolagem: 'xl:overflow-x-auto',
    tabela: 'xl:table',
    cabecalho: 'xl:table-header-group xl:not-sr-only',
    corpo: 'xl:table-row-group xl:divide-y xl:divide-line',
    rodape: 'xl:table-footer-group',
    linha: 'xl:table-row xl:mb-0 xl:rounded-none xl:border-0 xl:p-0 xl:shadow-none',
    celula: 'xl:table-cell xl:px-6 xl:py-4 xl:before:hidden',
    celulaCompacta: 'xl:table-cell xl:px-2.5 xl:py-3 xl:before:hidden',
    alinhamento: { left: 'xl:text-left', center: 'xl:text-center', right: 'xl:text-right' },
  },
} as const;

interface DataTableProps<Row> {
  // Nome da tabela para o leitor de tela; não é desenhado.
  caption: string;
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string | number;
  loading?: boolean;
  // Linhas de esqueleto no primeiro carregamento.
  loadingRows?: number;
  empty?: React.ReactNode;
  stackBelow?: keyof typeof QUEBRA;
  // Menos espaço entre colunas na tabela larga: para muitas colunas em telas com barra lateral.
  compact?: boolean;
  className?: string;
}

function DataTable<Row>({ caption, columns, rows, rowKey, loading = false, loadingRows = 4, empty, stackBelow = 'md', compact = false, className = '' }: DataTableProps<Row>) {
  const q = QUEBRA[stackBelow];
  const classeDaLinha = `mb-3 block rounded-card border border-line bg-surface p-2 shadow-card ${q.linha}`;
  const temRodape = columns.some((coluna) => coluna.footer !== undefined);

  const celula = (coluna: Column<Row>, conteudo: React.ReactNode) => (
    <td
      key={coluna.key}
      data-label={coluna.semRotuloNoCartao ? undefined : coluna.header}
      className={`flex items-start justify-between gap-4 px-3 py-2 text-sm before:text-xs before:font-semibold before:uppercase before:tracking-wide before:text-ink-muted before:content-[attr(data-label)] ${compact ? q.celulaCompacta : q.celula} ${q.alinhamento[coluna.align ?? 'left']} ${coluna.className ?? ''}`}
    >
      <div className={`min-w-0 ${coluna.semRotuloNoCartao ? 'w-full' : 'text-right md:[text-align:inherit]'}`}>{conteudo}</div>
    </td>
  );

  if (!loading && rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={`${q.rolagem} ${className}`}>
      <table className={`block w-full border-collapse text-left ${q.tabela}`} aria-busy={loading || undefined}>
        <caption className="sr-only">{caption}</caption>
        <thead className={`sr-only ${q.cabecalho}`}>
          <tr className="border-b border-line bg-surface-muted">
            {columns.map((coluna) => (
              <th key={coluna.key} scope="col" className={`${compact ? 'px-2.5' : 'px-6'} py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted ${q.alinhamento[coluna.align ?? 'left']}`}>{coluna.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className={`block ${q.corpo}`}>
          {loading
            ? Array.from({ length: loadingRows }, (_, i) => (
              <tr key={i} className={classeDaLinha}>
                <td colSpan={columns.length} className={`block px-3 py-3 ${q.celula}`}><Skeleton className="h-6 w-full" /></td>
              </tr>
            ))
            : rows.map((row) => (
              <tr key={rowKey(row)} className={`${classeDaLinha} hover:bg-surface-muted`}>
                {columns.map((coluna) => celula(coluna, coluna.cell(row)))}
              </tr>
            ))}
        </tbody>
        {temRodape && !loading && (
          <tfoot className={`block ${q.rodape}`}>
            <tr className={`${classeDaLinha} bg-surface-sunken font-semibold`}>
              {columns.map((coluna) => celula(coluna, coluna.footer ?? null))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default DataTable;
