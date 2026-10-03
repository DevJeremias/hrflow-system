import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatarHoraDeBelem, type TipoPonto } from '../../utils/ponto';

interface Props {
  isRegistering: boolean;
  // Sem vínculo, ou enquanto o ponto de hoje carrega, nenhuma marcação pode ser feita.
  disabled: boolean;
  proximosTipos: readonly TipoPonto[];
  onPunchClock: (tipo: TipoPonto) => void;
}

const DashboardPunchCard: React.FC<Props> = ({ isRegistering, disabled, proximosTipos, onPunchClock }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = formatarHoraDeBelem(currentTime);

  return (
    <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-10 flex flex-col items-center justify-center relative overflow-hidden group">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-slate-50 rounded-full blur-3xl -z-10 group-hover:bg-indigo-50/50 transition-colors duration-1000"></div>

      <div className="text-center mb-10 z-10">
        <h2 className="text-7xl md:text-8xl font-black text-slate-900 tracking-tighter tabular-nums drop-shadow-sm">
          {formattedTime}
        </h2>
        <p className="text-slate-400 font-bold tracking-widest uppercase text-sm mt-4 flex items-center justify-center gap-2">
          <Clock size={16} /> Horário de Belém
        </p>
      </div>

      <div className="z-10 w-full max-w-sm">
        {proximosTipos.length === 0 ? (
          <div className="flex items-center justify-center gap-3 bg-emerald-50 text-emerald-600 p-6 rounded-3xl border border-emerald-100">
            <CheckCircle2 size={28} />
            <span className="font-black text-lg">Jornada Concluída</span>
          </div>
        ) : (
          <div className="space-y-3">
            {proximosTipos.map((tipo) => (
              <button key={tipo} onClick={() => onPunchClock(tipo)} disabled={disabled} className="w-full relative group/btn overflow-hidden rounded-[2rem] bg-slate-900 text-white p-1 disabled:opacity-60">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-primary to-indigo-600 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-center justify-center gap-3 bg-slate-900 group-hover/btn:bg-opacity-0 px-8 py-6 rounded-[1.8rem] transition-all duration-300">
                  {isRegistering ? (
                    <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <><div className="bg-white/10 p-2 rounded-xl"><Clock size={24} /></div><span className="font-black text-xl tracking-tight">{tipo === 'Saída' && proximosTipos.length > 1 ? 'Encerrar jornada (Saída)' : `Registrar ${tipo}`}</span></>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        <p className="text-center text-xs font-medium text-slate-400 mt-4 flex items-center justify-center gap-1">
          <AlertCircle size={14} /> Localização capturada via GPS
        </p>
      </div>
    </div>
  );
};

export default DashboardPunchCard;