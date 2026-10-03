import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { useHeadcount } from '../../queries/relatorios';
import { queryDoRelatorio, type HeadcountRow } from '../../services/relatoriosService';
import { mesAtualNoFuso, mesesAntes, rotuloDaCompetencia } from '../../utils/competencia';
import { formatarPercentual } from '../../utils/moeda';
import { useFusoDaEmpresa } from '../../hooks/useFusoDaEmpresa';
import Card from '../ui/Card';
import DataTable, { type Column } from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import Field, { Input } from '../ui/Field';
import CorpoDoRelatorio from './CorpoDoRelatorio';
import ExportarRelatorio from './ExportarRelatorio';
import GraficoDeHeadcount from './GraficoDeHeadcount';

const MESES_PADRAO = 12;

// Quem entrou, quem saiu e quantos ficaram a cada mês, com o turnover (desligamentos sobre a média de ativos).
const RelatorioDeHeadcount: React.FC = () => {
  const fuso = useFusoDaEmpresa();
  const [ate, setAte] = useState(() => mesAtualNoFuso(fuso));
  const [de, setDe] = useState(() => mesesAntes(mesAtualNoFuso(fuso), MESES_PADRAO - 1));
  const { data, error, isPending, refetch } = useHeadcount(de, ate);
  const linhas = data ?? [];

  // O período nunca fica invertido: mexer numa ponta arrasta a outra.
  const trocarDe = (mes: string) => { setDe(mes); if (mes > ate) setAte(mes); };
  const trocarAte = (mes: string) => { setAte(mes); if (mes < de) setDe(mes); };

  const admitidos = linhas.reduce((soma, linha) => soma + linha.admitidos, 0);
  const desligados = linhas.reduce((soma, linha) => soma + linha.desligados, 0);

  const colunas: Column<HeadcountRow>[] = [
    { key: 'mes', header: 'Mês', cell: (linha) => <span className="font-semibold text-ink">{rotuloDaCompetencia(linha.mes)}</span>, footer: 'No período' },
    { key: 'admitidos', header: 'Admitidos', align: 'right', cell: (linha) => linha.admitidos, footer: admitidos },
    { key: 'desligados', header: 'Desligados', align: 'right', cell: (linha) => linha.desligados, footer: desligados },
    { key: 'ativos', header: 'Ativos no fim do mês', align: 'right', cell: (linha) => <span className="font-semibold text-ink">{linha.ativos}</span>, footer: linhas.at(-1)?.ativos },
    { key: 'turnover', header: 'Turnover', align: 'right', cell: (linha) => formatarPercentual(linha.turnover), footer: '' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="De" name="de"><Input type="month" autoComplete="off" value={de} max={ate} onChange={(e) => e.target.value && trocarDe(e.target.value)} /></Field>
          <Field label="Até" name="ate"><Input type="month" autoComplete="off" value={ate} onChange={(e) => e.target.value && trocarAte(e.target.value)} /></Field>
        </div>
        <ExportarRelatorio relatorio="headcount" query={queryDoRelatorio.headcount(de, ate)} />
      </div>

      <CorpoDoRelatorio carregando={isPending} erro={error} mensagemDeErroPadrao="Erro ao carregar o headcount" aoTentarDeNovo={() => { void refetch(); }}>
        <Card as="section" aria-label="Colaboradores ativos por mês" padding="lg">
          <GraficoDeHeadcount linhas={linhas} titulo="Colaboradores ativos no fim de cada mês" />
        </Card>
        <Card as="section" padding="none">
          <DataTable
            caption="Headcount e turnover por mês"
            columns={colunas}
            rows={linhas}
            rowKey={(linha) => linha.mes}
            empty={<EmptyState icon={<Users size={28} />} title="Nenhum mês neste período." />}
          />
        </Card>
        <p className="text-xs text-ink-muted">
          Ativos no fim do mês: quem já estava admitido e ainda não tinha sido desligado. Turnover: desligamentos do mês sobre a média de ativos do começo e do fim do mês.
        </p>
      </CorpoDoRelatorio>
    </div>
  );
};

export default RelatorioDeHeadcount;
