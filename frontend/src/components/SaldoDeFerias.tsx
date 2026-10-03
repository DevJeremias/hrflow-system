import React from 'react';
import { CalendarClock, Info } from 'lucide-react';
import type { SaldoDeFeriasApi } from '../types/api';
import { avisoDoSaldo, formatarDia, rotuloDosDias } from '../utils/solicitacoes';
import Badge from './ui/Badge';
import Card, { CardHeader } from './ui/Card';

interface Props {
  saldo: SaldoDeFeriasApi;
  // Dentro de uma linha da fila do RH: sem cartão próprio e com o título em texto corrido.
  compacto?: boolean;
}

const Numero: React.FC<{ rotulo: string; valor: number }> = ({ rotulo, valor }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{rotulo}</dt>
    <dd className="mt-0.5 text-lg font-bold text-ink">{rotuloDosDias(valor)}</dd>
  </div>
);

// O saldo de férias e o período aquisitivo (CLT, arts. 129 a 134): 30 dias a cada 12 meses de trabalho,
// descontados os dias já aprovados e os em análise.
const SaldoDeFerias: React.FC<Props> = ({ saldo, compacto = false }) => {
  const aviso = avisoDoSaldo(saldo);
  const corpo = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-3xl font-extrabold tracking-tight text-ink">{rotuloDosDias(saldo.saldo)}<span className="ml-2 text-sm font-semibold text-ink-muted">disponíveis</span></p>
        {saldo.vencido && <Badge tone="danger">Prazo vencido</Badge>}
      </div>

      {aviso && (
        <p className="flex gap-2 rounded-control bg-info-soft p-3 text-sm font-medium text-info">
          <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </p>
      )}

      <dl className="grid grid-cols-3 gap-3">
        <Numero rotulo="Adquiridos" valor={saldo.diasAdquiridos} />
        <Numero rotulo="Aprovados" valor={saldo.diasAprovados} />
        <Numero rotulo="Em análise" valor={saldo.diasEmAnalise} />
      </dl>

      <dl className="space-y-1 text-sm">
        {saldo.periodoAquisitivo && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold text-ink">Período aquisitivo em curso:</dt>
            <dd className="text-ink-muted">{formatarDia(saldo.periodoAquisitivo.inicio)} a {formatarDia(saldo.periodoAquisitivo.fim)}</dd>
          </div>
        )}
        {saldo.prazoParaGozo && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold text-ink">{saldo.vencido ? 'Venceu em:' : 'Gozar até:'}</dt>
            <dd className={saldo.vencido ? 'font-semibold text-danger' : 'text-ink-muted'}>{formatarDia(saldo.prazoParaGozo)}</dd>
          </div>
        )}
      </dl>
    </div>
  );

  if (compacto) return <section aria-label="Saldo de férias" className="rounded-card border border-line bg-surface-muted p-4">{corpo}</section>;

  return (
    <Card as="section" padding="none" aria-label="Saldo de férias" className="overflow-hidden">
      <CardHeader title="Saldo de férias" icon={<CalendarClock size={20} />} />
      <div className="p-5 sm:p-6">{corpo}</div>
    </Card>
  );
};

export default SaldoDeFerias;
