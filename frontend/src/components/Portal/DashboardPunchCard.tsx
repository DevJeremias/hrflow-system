import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatarHoraNoFuso, type TipoPonto } from '../../utils/ponto';
import { cidadeDoFuso } from '../../utils/fuso';
import { useFusoDaEmpresa } from '../../hooks/useFusoDaEmpresa';
import Button from '../ui/Button';
import Card from '../ui/Card';

interface Props {
  isRegistering: boolean;
  // Sem vínculo, ou enquanto o ponto de hoje carrega, nenhuma marcação pode ser feita.
  disabled: boolean;
  proximosTipos: readonly TipoPonto[];
  onPunchClock: (tipo: TipoPonto) => void;
}

const DashboardPunchCard: React.FC<Props> = ({ isRegistering, disabled, proximosTipos, onPunchClock }) => {
  const fuso = useFusoDaEmpresa();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = formatarHoraNoFuso(currentTime, fuso);

  return (
    <Card as="section" aria-label="Registro de ponto" padding="lg" className="flex flex-col items-center justify-center lg:col-span-2">
      <div className="mb-8 text-center">
        {/* Sem região viva: o relógio muda a cada segundo e não deve ser anunciado. */}
        <time dateTime={currentTime.toISOString()} className="block text-6xl font-bold tabular-nums tracking-tighter text-ink md:text-8xl">
          {formattedTime}
        </time>
        <p className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-widest text-ink-muted">
          <Clock size={16} aria-hidden="true" /> Horário de {cidadeDoFuso(fuso)}
        </p>
      </div>

      <div className="w-full max-w-sm">
        {proximosTipos.length === 0 ? (
          <div className="flex items-center justify-center gap-3 rounded-card border border-success-line bg-success-soft p-6 text-success">
            <CheckCircle2 size={28} aria-hidden="true" />
            <span className="text-lg font-bold">Jornada Concluída</span>
          </div>
        ) : (
          <div className="space-y-3">
            {proximosTipos.map((tipo) => (
              <Button key={tipo} size="lg" fullWidth loading={isRegistering} disabled={disabled} onClick={() => onPunchClock(tipo)} icon={<Clock size={22} aria-hidden="true" />}>
                {tipo === 'Saída' && proximosTipos.length > 1 ? 'Encerrar jornada (Saída)' : `Registrar ${tipo}`}
              </Button>
            ))}
          </div>
        )}
        <p className="mt-4 flex items-center justify-center gap-1 text-xs font-medium text-ink-muted">
          <AlertCircle size={14} aria-hidden="true" /> Localização capturada via GPS
        </p>
      </div>
    </Card>
  );
};

export default DashboardPunchCard;
