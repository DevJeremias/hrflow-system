import React, { useState } from 'react';
import { CalendarX } from 'lucide-react';
import { useAbsenteismo } from '../../queries/relatorios';
import { queryDoRelatorio } from '../../services/relatoriosService';
import type { LinhaDeAbsenteismoApi } from '../../types/api';
import { mesAtualNoFuso, rotuloDaCompetencia } from '../../utils/competencia';
import { formatarPercentual } from '../../utils/moeda';
import { useFusoDaEmpresa } from '../../hooks/useFusoDaEmpresa';
import Card from '../ui/Card';
import DataTable, { type Column } from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import Field, { Input } from '../ui/Field';
import CorpoDoRelatorio from './CorpoDoRelatorio';
import ExportarRelatorio from './ExportarRelatorio';

// Faltas, ausências justificadas e atrasos por departamento, com a mesma regra da tela de ponto do colaborador.
const RelatorioDeAbsenteismo: React.FC = () => {
  const fuso = useFusoDaEmpresa();
  const [mes, setMes] = useState(() => mesAtualNoFuso(fuso));
  const { data, error, isPending, refetch } = useAbsenteismo(mes);

  const colunas: Column<LinhaDeAbsenteismoApi>[] = data ? [
    { key: 'departamento', header: 'Departamento', cell: (linha) => <span className="font-semibold text-ink">{linha.departamento}</span>, footer: 'Total' },
    { key: 'colaboradores', header: 'Colaboradores', align: 'right', cell: (linha) => linha.colaboradores, footer: data.total.colaboradores },
    { key: 'diasApurados', header: 'Dias apurados', align: 'right', cell: (linha) => linha.diasApurados, footer: data.total.diasApurados },
    { key: 'faltas', header: 'Faltas', align: 'right', cell: (linha) => linha.faltas, footer: data.total.faltas },
    { key: 'justificadas', header: 'Justificadas', align: 'right', cell: (linha) => linha.ausenciasJustificadas, footer: data.total.ausenciasJustificadas },
    { key: 'atrasos', header: 'Atrasos', align: 'right', cell: (linha) => linha.atrasos, footer: data.total.atrasos },
    { key: 'taxa', header: 'Taxa de absenteísmo', align: 'right', cell: (linha) => <span className="font-semibold text-ink">{formatarPercentual(linha.taxa)}</span>, footer: formatarPercentual(data.total.taxa) },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Field label="Mês" name="mes">
          <Input type="month" autoComplete="off" value={mes} max={mesAtualNoFuso(fuso)} onChange={(e) => e.target.value && setMes(e.target.value)} />
        </Field>
        <ExportarRelatorio relatorio="absenteismo" query={queryDoRelatorio.absenteismo(mes)} />
      </div>

      <CorpoDoRelatorio carregando={isPending} erro={error} mensagemDeErroPadrao="Erro ao carregar o absenteísmo" aoTentarDeNovo={() => { void refetch(); }}>
        {data && (
          <>
            <Card as="section" padding="none">
              <DataTable
                caption={`Absenteísmo por departamento em ${rotuloDaCompetencia(data.mes)}`}
                columns={colunas}
                rows={data.departamentos}
                rowKey={(linha) => linha.departamento}
                stackBelow="xl"
                compact
                empty={<EmptyState icon={<CalendarX size={28} />} title="Nenhum colaborador a apurar neste mês." />}
              />
            </Card>
            <p className="text-xs text-ink-muted">
              Só entram os dias úteis já encerrados, depois da admissão e até o desligamento. Falta é o dia sem marcação e sem justificativa aprovada; justificada é o dia
              sem marcação abonado pelo RH. Taxa: (faltas + justificadas) sobre os dias apurados.
            </p>
          </>
        )}
      </CorpoDoRelatorio>
    </div>
  );
};

export default RelatorioDeAbsenteismo;
