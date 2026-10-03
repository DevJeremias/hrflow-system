import React from 'react';
import { Play, Coffee, Square, CheckCircle2, Clock } from 'lucide-react';
import { PointRecord } from '../../services/pontoService';
import Badge from '../ui/Badge';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';

interface Props {
  records: PointRecord[];
}

// A resposta do POST de registro pode vir com os nomes da API (tipo, horario) em vez dos do front-end.
type Registro = PointRecord & { tipo?: string; horario?: string };

const ICONES: Record<string, React.ReactNode> = {
  'Entrada': <Play size={16} className="text-success" />,
  'Pausa Almoço': <Coffee size={16} className="text-warning" />,
  'Retorno Almoço': <Play size={16} className="text-brand" />,
  'Saída': <Square size={16} className="text-danger" />,
};

const DashboardTimeline: React.FC<Props> = ({ records }) => (
  <Card as="section" aria-labelledby="registros-de-hoje" padding="lg" className="flex flex-col">
    <h2 id="registros-de-hoje" className="mb-6 flex items-center gap-3 text-lg font-bold text-ink">
      Registros de Hoje
      <Badge>{records.length}/4</Badge>
    </h2>

    {records.length === 0 ? (
      <EmptyState icon={<Clock size={24} />} title="Nenhum ponto registrado" description="Os registros de hoje aparecem aqui." className="flex-1 py-6" />
    ) : (
      <ol className="space-y-5">
        {(records as Registro[]).map((reg, index) => {
          const type = reg.type || reg.tipo || 'Desconhecido';
          const time = reg.time || reg.horario || '--:--';
          return (
          <li key={reg.id || index} className="flex gap-4 animate-in fade-in duration-200">
            <span aria-hidden="true" className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-line bg-surface shadow-card">
              {ICONES[type] ?? <CheckCircle2 size={16} className="text-ink-muted" />}
            </span>
            <div className="flex flex-col justify-center">
              <span className="text-sm font-semibold text-ink-muted">{type}</span>
              <span className="text-2xl font-bold tracking-tight text-ink">{time}</span>
            </div>
          </li>
          );
        })}
      </ol>
    )}
  </Card>
);

export default DashboardTimeline;
