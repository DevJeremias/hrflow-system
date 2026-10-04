import React from 'react';
import { Link } from 'react-router-dom';
import { Cake, TrendingUp } from 'lucide-react';
import { useAniversariantes, useHeadcount } from '../../queries/relatorios';
import { mesAtualNoFuso, mesesAntes, rotuloDaCompetencia } from '../../utils/competencia';
import { formatarPercentual } from '../../utils/moeda';
import { mensagemDeErro } from '../../utils/erros';
import { useFusoDaEmpresa } from '../../hooks/useFusoDaEmpresa';
import Card, { CardHeader } from '../ui/Card';
import Badge from '../ui/Badge';
import Skeleton from '../ui/Skeleton';
import ErrorAlert from '../ErrorAlert';
import GraficoDeHeadcount from './GraficoDeHeadcount';

const MESES_DO_GRAFICO = 12;
const ANIVERSARIANTES_NA_LISTA = 6;

// O que o gestor vê ao abrir o painel: a evolução do quadro nos últimos 12 meses (admitidos, desligados e
// turnover do mês corrente) e quem faz aniversário no mês. Os relatórios completos ficam em /admin/relatorios.
const DashboardAnalitico: React.FC = () => {
  const fuso = useFusoDaEmpresa();
  const mes = mesAtualNoFuso(fuso);
  const headcount = useHeadcount(mesesAntes(mes, MESES_DO_GRAFICO - 1), mes);
  const aniversariantes = useAniversariantes(mes);
  const atual = headcount.data?.at(-1);
  const proximos = aniversariantes.data?.slice(0, ANIVERSARIANTES_NA_LISTA) ?? [];
  const restantes = (aniversariantes.data?.length ?? 0) - proximos.length;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card as="section" padding="none" aria-label="Colaboradores ativos por mês" className="overflow-hidden xl:col-span-2">
        <CardHeader
          title="Colaboradores ativos por mês"
          icon={<TrendingUp size={20} />}
          actions={<Link to="/admin/relatorios" className="text-sm font-semibold text-brand underline underline-offset-4 hover:text-brand-hover">Ver relatórios</Link>}
        />
        <div className="space-y-6 p-5 sm:p-6">
          {headcount.isPending ? (
            <Skeleton className="h-56 w-full" />
          ) : headcount.error ? (
            <ErrorAlert message={mensagemDeErro(headcount.error, 'Erro ao carregar o headcount')} onRetry={() => { void headcount.refetch(); }} />
          ) : (
            <>
              {atual && (
                <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  Em {rotuloDaCompetencia(atual.mes)}:
                  <Badge tone="success">{atual.admitidos} {atual.admitidos === 1 ? 'admitido' : 'admitidos'}</Badge>
                  <Badge tone={atual.desligados > 0 ? 'warning' : 'neutral'}>{atual.desligados} {atual.desligados === 1 ? 'desligado' : 'desligados'}</Badge>
                  <Badge tone="brand">Turnover {formatarPercentual(atual.turnover)}</Badge>
                </p>
              )}
              <GraficoDeHeadcount linhas={headcount.data ?? []} titulo="Colaboradores ativos no fim de cada mês, nos últimos 12 meses" />
            </>
          )}
        </div>
      </Card>

      <Card as="section" padding="none" aria-label="Aniversariantes do mês" className="overflow-hidden">
        <CardHeader title={`Aniversariantes de ${rotuloDaCompetencia(mes)}`} icon={<Cake size={20} />} />
        <div className="p-5 sm:p-6">
          {aniversariantes.isPending ? (
            <div className="space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
          ) : aniversariantes.error ? (
            <ErrorAlert message={mensagemDeErro(aniversariantes.error, 'Erro ao carregar os aniversariantes')} onRetry={() => { void aniversariantes.refetch(); }} />
          ) : proximos.length === 0 ? (
            <p className="text-sm text-ink-muted">Ninguém faz aniversário neste mês.</p>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {proximos.map((aniversariante) => (
                  <li key={aniversariante.funcionarioId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate font-semibold text-ink">{aniversariante.nome}</span>
                    <span className="shrink-0 text-ink-muted">dia {aniversariante.dia}</span>
                  </li>
                ))}
              </ul>
              {restantes > 0 && (
                <Link to="/admin/relatorios" className="mt-3 inline-block text-sm font-semibold text-brand underline underline-offset-4 hover:text-brand-hover">
                  e mais {restantes}
                </Link>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default DashboardAnalitico;
